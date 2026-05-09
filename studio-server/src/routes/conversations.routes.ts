import { Router } from 'express';
import { conversationStore } from '../services/conversation.store.js';
import { aiService } from '../services/ai.service.js';
import { gherkinValidator } from '../services/gherkin-validator.service.js';
import { ProjectsRepo } from '../db/repositories/projects.repo.js';
import {
  parseOrFail,
  UuidParam,
  CreateConversationBody,
  CreateConversationQuery,
  SendMessageBody,
} from '../utils/zod.js';

export const conversationsRouter = Router();

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

    const userMessage = await conversationStore.appendUser(conv.id, body.content);

    if (!aiService.isConfigured()) {
      const stub =
        'AI offline — neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set in studio-server/.env. Add at least one key and restart the server to enable test generation.';
      const assistantMessage = await conversationStore.appendAssistant(conv.id, stub);
      res.json({ userMessage, assistantMessage, generation: null, validation: null });
      return;
    }

    try {
      const history = (await conversationStore.toChatTurns(conv.id)).filter(
        (t) => t.content !== body.content
      );
      const generation = await aiService.generate(history, body.content, body.model);
      const validation = generation.featureContent
        ? gherkinValidator.validate(generation.featureContent)
        : null;
      const assistantMessage = await conversationStore.appendAssistant(
        conv.id,
        generation.explanation,
        generation
      );
      res.json({ userMessage, assistantMessage, generation, validation });
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

