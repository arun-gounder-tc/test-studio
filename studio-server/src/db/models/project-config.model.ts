import {
  Table, Column, Model, DataType, PrimaryKey, Default,
  BelongsTo, ForeignKey, CreatedAt, UpdatedAt,
} from 'sequelize-typescript';
import { Project } from './project.model.js';

@Table({ tableName: 'project_configs', timestamps: false })
export class ProjectConfig extends Model {
  @PrimaryKey
  @ForeignKey(() => Project)
  @Column({ field: 'project_id', type: DataType.UUID })
  declare projectId: string;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  declare routes: object;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  declare selectors: object;

  @Column({ field: 'auth_adapter', type: DataType.JSONB, allowNull: false, defaultValue: {} })
  declare authAdapter: object;

  @Column({ field: 'default_model', type: DataType.TEXT, allowNull: false, defaultValue: 'gpt-4o-mini' })
  declare defaultModel: string;

  @Column({ field: 'updated_at', type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updatedAt: Date;

  @BelongsTo(() => Project)
  declare project: Project;
}
