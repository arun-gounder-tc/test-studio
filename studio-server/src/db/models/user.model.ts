import {
  Table, Column, Model, DataType, PrimaryKey, Default, CreatedAt,
} from 'sequelize-typescript';

@Table({ tableName: 'users', timestamps: false })
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.TEXT, allowNull: false, unique: true })
  declare email: string;

  @Column({ field: 'display_name', type: DataType.TEXT })
  declare displayName: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    defaultValue: 'tester',
    validate: { isIn: [['tester', 'lead', 'admin']] },
  })
  declare role: 'tester' | 'lead' | 'admin';

  @CreatedAt
  @Column({ field: 'created_at', type: DataType.DATE })
  declare createdAt: Date;
}
