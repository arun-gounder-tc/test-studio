import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  BelongsTo, ForeignKey,
} from 'sequelize-typescript';
import { Test } from './test.model.js';

@Table({ tableName: 'test_versions', timestamps: false })
export class TestVersion extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Test)
  @Column({ field: 'test_id', type: DataType.UUID, allowNull: false })
  declare testId: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare version: number;

  @Column({ field: 'feature_content', type: DataType.TEXT, allowNull: false })
  declare featureContent: string;

  @Column({ field: 'step_definitions', type: DataType.JSONB, allowNull: false, defaultValue: [] })
  declare stepDefinitions: object[];

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  declare fixtures: object[];

  @Column({ field: 'change_summary', type: DataType.TEXT })
  declare changeSummary: string | null;

  @Column({ field: 'saved_by', type: DataType.UUID })
  declare savedBy: string | null;

  @Column({ field: 'saved_at', type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare savedAt: Date;

  @BelongsTo(() => Test)
  declare test: Test;
}
