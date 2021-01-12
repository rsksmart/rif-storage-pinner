import { Table, Column, Model, DataType } from 'sequelize-typescript'

@Table({
  freezeTableName: true,
  tableName: 'message',
  timestamps: false
})
export default class Message extends Model {
  @Column({ allowNull: false, type: DataType.STRING(20) })
  code!: string

  @Column({ type: DataType.STRING(67) })
  agreementReference!: string

  @Column({ allowNull: false, type: DataType.TEXT })
  message!: string
}
