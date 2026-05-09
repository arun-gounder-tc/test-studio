import { ChatAttachment } from '../models/chat-attachment.model.js';

export interface CreateAttachmentInput {
  messageId: number;
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
      messageId: input.messageId,
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

  async get(id: string): Promise<ChatAttachment | null> {
    return ChatAttachment.findByPk(id);
  },
};
