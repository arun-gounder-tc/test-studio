import {
  Table, Column, Model, DataType, PrimaryKey, Default,
  BelongsTo, ForeignKey, HasMany, CreatedAt, UpdatedAt,
} from 'sequelize-typescript';
import { Project } from './project.model.js';
import { TestVersion } from './test-version.model.js';
import { Run } from './run.model.js';
import { Conversation } from './conversation.model.js';

@Table({ tableName: 'tests', timestamps: true })
export class Test extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Project)
  @Column({ field: 'project_id', type: DataType.UUID, allowNull: false })
  declare projectId: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare slug: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare name: string;

  @Column(DataType.TEXT)
  declare description: string | null;

  @Column({ type: DataType.ARRAY(DataType.TEXT), allowNull: false, defaultValue: [] })
  declare tags: string[];

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    validate: { isIn: [['manual', 'ai-generated', 'uploaded', 'imported']] },
  })
  declare source: 'manual' | 'ai-generated' | 'uploaded' | 'imported';

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    defaultValue: 'saved',
    validate: { isIn: [['draft', 'saved', 'archived']] },
  })
  declare status: 'draft' | 'saved' | 'archived';

  @Column({ field: 'current_version', type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
  declare currentVersion: number;

  @Column({ field: 'created_by', type: DataType.UUID })
  declare createdBy: string | null;

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at', type: DataType.DATE })
  declare updatedAt: Date;

  @BelongsTo(() => Project)
  declare project: Project;

  @HasMany(() => TestVersion)
  declare versions: TestVersion[];

  @HasMany(() => Run)
  declare runs: Run[];

  @HasMany(() => Conversation)
  declare conversations: Conversation[];
}
