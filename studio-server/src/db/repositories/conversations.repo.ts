import { Op } from 'sequelize';
import { Conversation } from '../models/conversation.model.js';
import { Message } from '../models/message.model.js';
import type { GenerationResult } from '../../services/ai-providers/provider.interface.js';

export interface CreateConversationInput {
  projectId: string;
  defaultModel?: string;
  originatingTestId?: string;
}

export const ConversationsRepo = {
  async create(input: CreateConversationInput): Promise<Conversation> {
    return Conversation.create({
      projectId: input.projectId,
      defaultModel: input.defaultModel ?? null,
      originatingTestId: input.originatingTestId ?? null,
    });
  },

  async get(id: string): Promise<Conversation | null> {
    return Conversation.findByPk(id, {
      include: [{ model: Message, as: 'messages', order: [['createdAt', 'ASC']] }],
    });
  },

  async list(projectId?: string): Promise<Conversation[]> {
    const where = projectId ? { projectId } : {};
    return Conversation.findAll({
      where,
      order: [['startedAt', 'DESC']],
    });
  },

  async appendUserMessage(conversationId: string, content: string): Promise<Message> {
    return Message.create({ conversationId, role: 'user', content });
  },

  async appendAssistantMessage(
    conversationId: string,
    content: string,
    generation: GenerationResult
  ): Promise<Message> {
    return Message.create({
      conversationId,
      role: 'assistant',
      content,
      metadata: { generation },
    });
  },

  async setOriginatingTest(conversationId: string, testId: string): Promise<void> {
    await Conversation.update({ originatingTestId: testId }, { where: { id: conversationId } });
  },

  /** Returns messages as ChatTurn array for AI provider history */
  async toChatTurns(conversationId: string): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = await Message.findAll({
      where: { conversationId, role: { [Op.in]: ['user', 'assistant'] } },
      order: [['createdAt', 'ASC']],
    });
    return messages
      .filter((m) => m.content !== null)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content! }));
  },
};
