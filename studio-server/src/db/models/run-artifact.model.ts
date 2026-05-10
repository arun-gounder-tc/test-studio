import {
  Table, Column, Model, DataType, PrimaryKey, Default,
  BelongsTo, ForeignKey,
} from 'sequelize-typescript';
import { Run } from './run.model.js';

@Table({ tableName: 'run_artifacts', timestamps: false })
export class RunArtifact extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Run)
  @Column({ field: 'run_id', type: DataType.UUID, allowNull: false })
  declare runId: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    validate: { isIn: [['video', 'screenshot', 'report', 'log-bundle']] },
  })
  declare kind: 'video' | 'screenshot' | 'report' | 'log-bundle';

  @Column({ field: 'minio_key', type: DataType.TEXT, allowNull: false })
  declare minioKey: string;

  @Column({ field: 'content_type', type: DataType.TEXT, allowNull: false })
  declare contentType: string;

  @Column({ field: 'size_bytes', type: DataType.BIGINT, allowNull: false })
  declare sizeBytes: number;

  @Column({ field: 'scenario_name', type: DataType.TEXT })
  declare scenarioName: string | null;

  @Column({ field: 'created_at', type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare createdAt: Date;

  @BelongsTo(() => Run)
  declare run: Run;
}
