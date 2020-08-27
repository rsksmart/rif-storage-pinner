import { Table, Column, Model } from 'sequelize-typescript'

@Table({
  freezeTableName: true,
  tableName: 'swarm',
  timestamps: false
})
export default class DirectAddressModel extends Model {
  @Column({ allowNull: false })
  peerId!: string

  @Column({ allowNull: false })
  agreementReference!: number
}
