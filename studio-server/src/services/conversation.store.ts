/**
 * conversation.store.ts
 * DB-backed wrapper over ConversationsRepo + MessagesRepo.
 * Keeps the same surface the routes depend on so migration is non-breaking.
 */
import { ConversationsRepo } from '../db/repositories/conversations.repo.js';
import { Message } from '../db/models/message.model.js';
import type { ChatTurn, GenerationResult } from './ai.service.js';

export interface MessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  generation?: GenerationResult;
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

