import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  BelongsTo, ForeignKey,
} from 'sequelize-typescript';
import { Run } from './run.model.js';

@Table({ tableName: 'run_logs', timestamps: false })
export class RunLog extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  declare id: number;

  @ForeignKey(() => Run)
  @Column({ field: 'run_id', type: DataType.UUID, allowNull: false })
  declare runId: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare sequence: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    validate: { isIn: [['stdout', 'stderr', 'event']] },
  })
  declare stream: 'stdout' | 'stderr' | 'event';

  @Column({ type: DataType.TEXT, allowNull: false })
  declare line: string;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare ts: Date;

  @BelongsTo(() => Run)
  declare run: Run;
}
