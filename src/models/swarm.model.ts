import { Table, Column, Model } from 'sequelize-typescript'

@Table({
  freezeTableName: true,
  tableName: 'swarm',
  timestamps: false
})
export default class SwarmModel extends Model {
  @Column({ allowNull: false })
  multiaddr!: string

  @Column({ allowNull: false })
  agreementReference!: number
}
