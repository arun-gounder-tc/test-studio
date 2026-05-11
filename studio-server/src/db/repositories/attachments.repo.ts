import { ChatAttachment } from '../models/chat-attachment.model.js';

export interface CreateAttachmentInput {
  conversationId: string;
  messageId?: number;
  kind: 'image' | 'file';
  minioKey: string;
  contentType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}

export const AttachmentsRepo = {
  async create(input: CreateAttachmentInput): Promise<ChatAttachment> {
    return ChatAttachment.create({
      conversationId: input.conversationId,
      messageId: input.messageId ?? null,
      kind: input.kind,
      minioKey: input.minioKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      width: input.width ?? null,
      height: input.height ?? null,
    });
  },

  async listByMessage(messageId: number): Promise<ChatAttachment[]> {
    return ChatAttachment.findAll({ where: { messageId } });
  },

  async listByConversation(conversationId: string): Promise<ChatAttachment[]> {
    return ChatAttachment.findAll({ where: { conversationId } });
  },

  async get(id: string): Promise<ChatAttachment | null> {
    return ChatAttachment.findByPk(id);
  },

  /** Link a batch of orphan attachments to a freshly-created message. */
  async linkToMessage(ids: string[], messageId: number): Promise<void> {
    if (ids.length === 0) return;
    await ChatAttachment.update(
      { messageId },
      { where: { id: ids } }
    );
  },
};
