import { Table, Column, Model, DataType } from 'sequelize-typescript'

@Table({
  freezeTableName: true,
  tableName: 'jobs',
  timestamps: false
})
export default class JobModel extends Model {
  @Column({ type: DataType.STRING(), allowNull: false })
  name!: string

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
