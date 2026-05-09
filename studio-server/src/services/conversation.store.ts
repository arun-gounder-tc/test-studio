import { randomUUID } from 'node:crypto';
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
  /** When set, /tests/save will overwrite this existing test's file instead of creating a new one. */
  originatingTestId?: string;
}

class ConversationStore {
  private conversations = new Map<string, ConversationRecord>();

  create(): ConversationRecord {
    const conv: ConversationRecord = {
      id: randomUUID(),
      startedAt: new Date().toISOString(),
      messages: [],
      latestGeneration: null,
    };
    this.conversations.set(conv.id, conv);
    return conv;
  }

  get(id: string): ConversationRecord | undefined {
    return this.conversations.get(id);
  }

  list(): ConversationRecord[] {
    return Array.from(this.conversations.values()).sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt)
    );
  }

  appendUser(id: string, content: string): MessageRecord {
    const conv = this.requireConv(id);
    const msg: MessageRecord = {
      id: randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    conv.messages.push(msg);
    return msg;
  }

  appendAssistant(id: string, content: string, generation?: GenerationResult): MessageRecord {
    const conv = this.requireConv(id);
    const msg: MessageRecord = {
      id: randomUUID(),
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
      generation,
    };
    conv.messages.push(msg);
    if (generation) conv.latestGeneration = generation;
    return msg;
  }

  toChatTurns(id: string): ChatTurn[] {
    const conv = this.requireConv(id);
    return conv.messages.map((m) => ({ role: m.role, content: m.content }));
  }

  setOriginatingTestId(id: string, testId: string): void {
    const conv = this.requireConv(id);
    conv.originatingTestId = testId;
  }

  private requireConv(id: string): ConversationRecord {
    const conv = this.conversations.get(id);
    if (!conv) throw new Error(`Conversation ${id} not found`);
    return conv;
  }
}

export const conversationStore = new ConversationStore();
