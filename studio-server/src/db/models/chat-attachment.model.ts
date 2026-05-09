import {
  Table, Column, Model, DataType, PrimaryKey, Default,
  BelongsTo, ForeignKey, CreatedAt,
} from 'sequelize-typescript';
import { Message } from './message.model.js';

@Table({ tableName: 'chat_attachments', timestamps: false })
export class ChatAttachment extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Message)
  @Column({ field: 'message_id', type: DataType.BIGINT, allowNull: false })
  declare messageId: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    validate: { isIn: [['image', 'file']] },
  })
  declare kind: 'image' | 'file';

  @Column({ field: 'minio_key', type: DataType.TEXT, allowNull: false })
  declare minioKey: string;

  @Column({ field: 'content_type', type: DataType.TEXT, allowNull: false })
  declare contentType: string;

  @Column({ field: 'size_bytes', type: DataType.BIGINT, allowNull: false })
  declare sizeBytes: number;

  @Column(DataType.INTEGER)
  declare width: number | null;

  @Column(DataType.INTEGER)
  declare height: number | null;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  declare createdAt: Date;

  @BelongsTo(() => Message)
  declare message: Message;
}
