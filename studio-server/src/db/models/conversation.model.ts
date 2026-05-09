import {
  Table, Column, Model, DataType, PrimaryKey, Default,
  BelongsTo, ForeignKey, HasMany,
} from 'sequelize-typescript';
import { Project } from './project.model.js';
import { Test } from './test.model.js';
import { Message } from './message.model.js';

@Table({ tableName: 'conversations', timestamps: false })
export class Conversation extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Project)
  @Column({ field: 'project_id', type: DataType.UUID, allowNull: false })
  declare projectId: string;

  @ForeignKey(() => Test)
  @Column({ field: 'originating_test_id', type: DataType.UUID })
  declare originatingTestId: string | null;

  @Column({ field: 'default_model', type: DataType.TEXT })
  declare defaultModel: string | null;

  @Column({ field: 'created_by', type: DataType.UUID })
  declare createdBy: string | null;

  @Column({ field: 'started_at', type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare startedAt: Date;

  @Column({ field: 'ended_at', type: DataType.DATE })
  declare endedAt: Date | null;

  @BelongsTo(() => Project)
  declare project: Project;

  @BelongsTo(() => Test)
  declare originatingTest: Test;

  @HasMany(() => Message)
  declare messages: Message[];
}
