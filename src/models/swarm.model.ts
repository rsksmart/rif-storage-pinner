import { Table, Column, Model } from 'sequelize-typescript'

@Table({
  freezeTableName: true,
  tableName: 'swarm',
  timestamps: false
})
export default class SwarmModel extends Model {
  @Column({ allowNull: false })
  peerId!: string

  @Column({ allowNull: false })
  signature!: string

  @Column({ allowNull: false })
  publicKey!: number
}
