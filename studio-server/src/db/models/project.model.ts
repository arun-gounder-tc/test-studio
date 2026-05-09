import {
  Table, Column, Model, DataType, PrimaryKey, Default,
  HasMany, HasOne, CreatedAt, UpdatedAt,
} from 'sequelize-typescript';
import { ProjectConfig } from './project-config.model.js';
import { Test } from './test.model.js';
import { Run } from './run.model.js';
import { Conversation } from './conversation.model.js';

@Table({ tableName: 'projects', timestamps: true })
export class Project extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.TEXT, allowNull: false, unique: true })
  declare slug: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare name: string;

  @Column(DataType.TEXT)
  declare description: string | null;

  @Column({ field: 'base_url', type: DataType.TEXT })
  declare baseUrl: string | null;

  @Column({ field: 'created_by', type: DataType.UUID })
  declare createdBy: string | null;

  @Column({ field: 'archived_at', type: DataType.DATE })
  declare archivedAt: Date | null;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  declare updatedAt: Date;

  @HasOne(() => ProjectConfig)
  declare config: ProjectConfig;

  @HasMany(() => Test)
  declare tests: Test[];

  @HasMany(() => Run)
  declare runs: Run[];

  @HasMany(() => Conversation)
  declare conversations: Conversation[];
}
