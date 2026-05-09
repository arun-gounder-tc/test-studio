import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  BelongsTo, ForeignKey, HasMany,
} from 'sequelize-typescript';
import { Conversation } from './conversation.model.js';
import { ChatAttachment } from './chat-attachment.model.js';

@Table({ tableName: 'messages', timestamps: false })
export class Message extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Conversation)
  @Column({ field: 'conversation_id', type: DataType.UUID, allowNull: false })
  declare conversationId: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    validate: { isIn: [['user', 'assistant', 'system']] },
  })
  declare role: 'user' | 'assistant' | 'system';

  @Column({ type: DataType.TEXT })
  declare content: string | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  declare metadata: object;

  @Column({ field: 'created_at', type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare createdAt: Date;

  @BelongsTo(() => Conversation)
  declare conversation: Conversation;

  @HasMany(() => ChatAttachment)
  declare attachments: ChatAttachment[];
}
