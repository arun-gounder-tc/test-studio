import {
  Table, Column, Model, DataType, PrimaryKey, Default,
  BelongsTo, ForeignKey, HasMany,
} from 'sequelize-typescript';
import { Project } from './project.model.js';
import { Test } from './test.model.js';
import { RunLog } from './run-log.model.js';
import { RunArtifact } from './run-artifact.model.js';

@Table({ tableName: 'runs', timestamps: false })
export class Run extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Project)
  @Column({ field: 'project_id', type: DataType.UUID, allowNull: false })
  declare projectId: string;

  @ForeignKey(() => Test)
  @Column({ field: 'test_id', type: DataType.UUID })
  declare testId: string | null;

  @Column({ field: 'test_version', type: DataType.INTEGER })
  declare testVersion: number | null;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    validate: { isIn: [['queued', 'running', 'passed', 'failed', 'errored', 'cancelled']] },
  })
  declare status: 'queued' | 'running' | 'passed' | 'failed' | 'errored' | 'cancelled';

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare headed: boolean;

  @Column({ field: 'exit_code', type: DataType.INTEGER })
  declare exitCode: number | null;

  @Column({ field: 'scenarios_total', type: DataType.INTEGER })
  declare scenariosTotal: number | null;

  @Column({ field: 'scenarios_passed', type: DataType.INTEGER })
  declare scenariosPassed: number | null;

  @Column({ field: 'scenarios_failed', type: DataType.INTEGER })
  declare scenariosFailed: number | null;

  @Column({ field: 'duration_ms', type: DataType.INTEGER })
  declare durationMs: number | null;

  @Column({ field: 'triggered_by', type: DataType.UUID })
  declare triggeredBy: string | null;

  @Column({ field: 'started_at', type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare startedAt: Date;

  @Column({ field: 'finished_at', type: DataType.DATE })
  declare finishedAt: Date | null;

  @BelongsTo(() => Project)
  declare project: Project;

  @BelongsTo(() => Test)
  declare test: Test;

  @HasMany(() => RunLog)
  declare logs: RunLog[];

  @HasMany(() => RunArtifact)
  declare artifacts: RunArtifact[];
}
