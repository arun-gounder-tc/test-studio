/**
 * conversation.store.ts
 * DB-backed wrapper over ConversationsRepo + MessagesRepo.
 * Keeps the same surface the routes depend on so migration is non-breaking.
 */
import { ConversationsRepo } from '../db/repositories/conversations.repo.js';
import { AttachmentsRepo } from '../db/repositories/attachments.repo.js';
import { Message } from '../db/models/message.model.js';
import { storage } from './storage/index.js';
import type { ChatTurn, GenerationResult } from './ai.service.js';

const ATTACHMENT_PRESIGN_TTL = 60 * 60;

export interface AttachmentRecord {
  id: string;
  kind: 'image' | 'file';
  contentType: string;
  sizeBytes: number;
  url: string;
}

export interface MessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  generation?: GenerationResult;
  attachments?: AttachmentRecord[];
}

export interface ConversationRecord {
  id: string;
  startedAt: string;
  messages: MessageRecord[];
  latestGeneration: GenerationResult | null;
  originatingTestId?: string;
}

function toMessageRecord(m: Message): MessageRecord {
  const meta = (m.metadata ?? {}) as Record<string, unknown>;
  return {
    id: String(m.id),
    role: m.role as 'user' | 'assistant',
    content: m.content ?? '',
    createdAt: (m.createdAt ?? new Date()).toISOString(),
    generation: (meta['generation'] as GenerationResult) ?? undefined,
  };
}

class ConversationStore {
  async create(projectId: string): Promise<ConversationRecord> {
    const conv = await ConversationsRepo.create({ projectId });
    return {
      id: conv.id,
      startedAt: conv.startedAt.toISOString(),
      messages: [],
      latestGeneration: null,
    };
  }

  async get(id: string): Promise<ConversationRecord | undefined> {
    const conv = await ConversationsRepo.get(id);
    if (!conv) return undefined;
    const messages = (conv.messages ?? []).map(toMessageRecord);

    // Bulk-load attachments for this conversation (only image kind shown in UI)
    const allAttachments = await AttachmentsRepo.listByConversation(id);
    if (allAttachments.length > 0) {
      const byMessageId = new Map<number, typeof allAttachments>();
      for (const a of allAttachments) {
        if (a.messageId == null) continue;
        const list = byMessageId.get(a.messageId) ?? [];
        list.push(a);
        byMessageId.set(a.messageId, list);
      }
      for (const m of messages) {
        const numId = Number(m.id);
        const atts = byMessageId.get(numId);
        if (!atts || atts.length === 0) continue;
        m.attachments = await Promise.all(
          atts.map(async (a) => ({
            id: a.id,
            kind: a.kind,
            contentType: a.contentType,
            sizeBytes: Number(a.sizeBytes),
            url: await storage.getPresignedUrl(a.minioKey, { expiresInSec: ATTACHMENT_PRESIGN_TTL }),
          }))
        );
      }
    }

    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.generation);
    return {
      id: conv.id,
      startedAt: conv.startedAt.toISOString(),
      messages,
      latestGeneration: lastAssistant?.generation ?? null,
      originatingTestId: conv.originatingTestId ?? undefined,
    };
  }

  async list(): Promise<ConversationRecord[]> {
    const convs = await ConversationsRepo.list();
    return convs.map((c) => ({
      id: c.id,
      startedAt: c.startedAt.toISOString(),
      messages: [],
      latestGeneration: null,
      originatingTestId: c.originatingTestId ?? undefined,
    }));
  }

  async appendUser(id: string, content: string): Promise<MessageRecord> {
    const msg = await ConversationsRepo.appendUserMessage(id, content);
    return toMessageRecord(msg);
  }

  async appendAssistant(id: string, content: string, generation?: GenerationResult): Promise<MessageRecord> {
    const msg = await ConversationsRepo.appendAssistantMessage(id, content, generation ?? ({} as GenerationResult));
    return toMessageRecord(msg);
  }

  async toChatTurns(id: string): Promise<ChatTurn[]> {
    return ConversationsRepo.toChatTurns(id);
  }

  async setOriginatingTestId(id: string, testId: string): Promise<void> {
    await ConversationsRepo.setOriginatingTest(id, testId);
  }
}

export const conversationStore = new ConversationStore();

