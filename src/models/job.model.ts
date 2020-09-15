import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript'
import Agreement from './agreement.model'

@Table({
  freezeTableName: true,
  tableName: 'jobs',
  timestamps: false
})
export default class JobModel extends Model {
  @Column({ type: DataType.STRING(), allowNull: false })
  name!: string

  @ForeignKey(() => Agreement)
  @Column({ type: DataType.STRING(67), allowNull: false })
  agreementReference!: string

  @BelongsTo(() => Agreement)
  agreement!: Agreement

  @Column({ type: DataType.ENUM('created', 'backoff', 'running', 'errored', 'finished'), allowNull: false, defaultValue: 'created' })
  state!: string

  @Column({ allowNull: false, defaultValue: 1 })
  tries!: number

  @Column
  type!: string

  @Column
  start!: Date

  @Column
  finish!: Date

  @Column
  retry!: string

  @Column
  errorMessage!: string
}
