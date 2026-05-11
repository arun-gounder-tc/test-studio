import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { conversationStore } from '../services/conversation.store.js';
import { aiService } from '../services/ai.service.js';
import { gherkinValidator } from '../services/gherkin-validator.service.js';
import { ProjectsRepo } from '../db/repositories/projects.repo.js';
import { AttachmentsRepo } from '../db/repositories/attachments.repo.js';
import { storage } from '../services/storage/index.js';
import {
  parseOrFail,
  UuidParam,
  CreateConversationBody,
  CreateConversationQuery,
  SendMessageBody,
} from '../utils/zod.js';

export const conversationsRouter = Router();

const ALLOWED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ATTACHMENT_PRESIGN_TTL = 60 * 60;     // 1 hour — for UI display
const AI_PRESIGN_TTL = 60 * 60;             // 1 hour — provider fetches within this window

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PNG, JPEG, WebP, GIF.`));
      return;
    }
    cb(null, true);
  },
});

/** Resolve active projectId — from body, query, or fallback to 'default' slug */
async function resolveProjectId(body: Record<string, unknown>, query: Record<string, unknown>): Promise<string | null> {
  const id = (body['projectId'] ?? query['projectId']) as string | undefined;
  if (id) return id;
  const def = await ProjectsRepo.getBySlug('default');
  return def?.id ?? null;
}

conversationsRouter.post('/', async (req, res) => {
  const body = parseOrFail(res, CreateConversationBody, req.body ?? {});
  if (!body) return;
  const query = parseOrFail(res, CreateConversationQuery, req.query);
  if (!query) return;
  try {
    const projectId = body.projectId ?? query.projectId ?? await resolveProjectId({}, {});
    if (!projectId) {
      res.status(400).json({ error: 'projectId is required (or create a project first)' });
      return;
    }
    const conv = await conversationStore.create(projectId);
    res.json({
      id: conv.id,
      startedAt: conv.startedAt,
      aiConfigured: aiService.isConfigured(),
      messages: [],
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create conversation' });
  }
});

conversationsRouter.get('/:id', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  try {
    const conv = await conversationStore.get(params.id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get conversation' });
  }
});

/**
 * POST /:id/attachments — upload image, store in MinIO, create chat_attachments row.
 * Returns attachment id + presigned URL (for instant preview in UI).
 * The attachment is "orphan" (messageId null) until a sendMessage references it.
 */
conversationsRouter.post('/:id/attachments', upload.single('file'), async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded (field name must be "file")' });
    return;
  }

  try {
    const conv = await conversationStore.get(params.id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const { mimetype, size, buffer, originalname } = req.file;
    if (!size || size === 0 || !buffer || buffer.length === 0) {
      res.status(400).json({ error: 'Uploaded file is empty (0 bytes). Pick or paste an actual image.' });
      return;
    }

    const ext = path.extname(originalname).toLowerCase() || '.png';
    const key = `chat-images/${params.id}/${randomUUID()}${ext}`;

    await storage.putObject({
      key,
      body: buffer,
      contentType: mimetype,
      sizeBytes: size,
    });

    const attachment = await AttachmentsRepo.create({
      conversationId: params.id,
      kind: 'image',
      minioKey: key,
      contentType: mimetype,
      sizeBytes: size,
    });

    const url = await storage.getPresignedUrl(key, { expiresInSec: ATTACHMENT_PRESIGN_TTL });

    res.json({
      id: attachment.id,
      kind: attachment.kind,
      contentType: attachment.contentType,
      sizeBytes: Number(attachment.sizeBytes),
      url,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to upload attachment' });
  }
});

conversationsRouter.post('/:id/messages', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  const body = parseOrFail(res, SendMessageBody, req.body);
  if (!body) return;
  try {
    const conv = await conversationStore.get(params.id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const attachmentIds = body.attachmentIds ?? [];
    const userMessage = await conversationStore.appendUser(conv.id, body.content);

    // Link uploaded attachments to this message
    if (attachmentIds.length > 0) {
      await AttachmentsRepo.linkToMessage(attachmentIds, Number(userMessage.id));
    }

    if (!aiService.isConfigured()) {
      const stub =
        'AI offline — neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set in studio-server/.env. Add at least one key and restart the server to enable test generation.';
      const assistantMessage = await conversationStore.appendAssistant(conv.id, stub);
      res.json({ userMessage, assistantMessage, generation: null, validation: null });
      return;
    }

    try {
      // Provider receives presigned URLs — no binary in the AI request body
      const attachmentImages = await loadAttachmentImageUrls(attachmentIds);

      const history = (await conversationStore.toChatTurns(conv.id)).filter(
        (t) => t.content !== body.content
      );
      const generation = await aiService.generate(
        history,
        body.content,
        body.model,
        attachmentImages
      );
      const validation = generation.featureContent
        ? gherkinValidator.validate(generation.featureContent)
        : null;
      const assistantMessage = await conversationStore.appendAssistant(
        conv.id,
        generation.explanation,
        generation
      );

      // Re-fetch user message with attachment metadata so UI can render thumbnails
      const userMessageWithAttachments = await enrichWithAttachments(userMessage, attachmentIds);
      res.json({ userMessage: userMessageWithAttachments, assistantMessage, generation, validation });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      const assistantMessage = await conversationStore.appendAssistant(
        conv.id,
        `⚠ AI error: ${message}`
      );
      res.status(502).json({ userMessage, assistantMessage, error: message });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/** Generate fresh presigned URLs for each attachment so the AI provider fetches directly. */
async function loadAttachmentImageUrls(
  ids: string[]
): Promise<Array<{ url: string; mediaType: string }>> {
  if (ids.length === 0) return [];
  const out: Array<{ url: string; mediaType: string }> = [];
  for (const id of ids) {
    const row = await AttachmentsRepo.get(id);
    if (!row || row.kind !== 'image') continue;
    const url = await storage.getPresignedUrl(row.minioKey, { expiresInSec: AI_PRESIGN_TTL });
    out.push({ url, mediaType: row.contentType });
  }
  return out;
}

/** Attach presigned URLs to the user message so the UI can render thumbnails. */
async function enrichWithAttachments(userMessage: any, attachmentIds: string[]) {
  if (attachmentIds.length === 0) return userMessage;
  const attachments = await Promise.all(
    attachmentIds.map(async (id) => {
      const row = await AttachmentsRepo.get(id);
      if (!row) return null;
      const url = await storage.getPresignedUrl(row.minioKey, { expiresInSec: ATTACHMENT_PRESIGN_TTL });
      return {
        id: row.id,
        kind: row.kind,
        contentType: row.contentType,
        sizeBytes: Number(row.sizeBytes),
        url,
      };
    })
  );
  return { ...userMessage, attachments: attachments.filter(Boolean) };
}
