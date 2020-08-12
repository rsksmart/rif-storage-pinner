import { Table, Column, Model, DataType } from 'sequelize-typescript'
import BigNumber from 'bignumber.js'

import { BigNumberStringType } from '../sequelize'
import { bn, bnFloor } from '../utils'

@Table({
  freezeTableName: true,
  tableName: 'storage_agreement',
  timestamps: false
})
export default class Agreement extends Model {
  @Column({ type: DataType.STRING(67), primaryKey: true, allowNull: false })
  agreementReference!: string

  @Column({ type: DataType.STRING(), allowNull: false })
  dataReference!: string

  @Column({ type: DataType.STRING(64), allowNull: false })
  consumer!: string

  @Column({ allowNull: false, ...BigNumberStringType('size') })
  size!: BigNumber

  @Column({ defaultValue: true })
  isActive!: boolean

  /**
   * Billing period IN SECONDS
   */
  @Column({ allowNull: false, ...BigNumberStringType('billingPeriod') })
  billingPeriod!: BigNumber

  @Column({ allowNull: false, ...BigNumberStringType('billingPrice') })
  billingPrice!: BigNumber

  @Column({ allowNull: false, ...BigNumberStringType('availableFunds') })
  availableFunds!: BigNumber

  @Column({ allowNull: false })
  lastPayout!: Date

  @Column({ type: DataType.NUMBER() })
  expiredAtBlockNumber!: number | null

  periodPrice (): BigNumber {
    return this.size.times(this.billingPrice)
  }

  @Column(DataType.VIRTUAL)
  get numberOfPrepaidPeriods (): BigNumber {
    return this.periodPrice().gt(0)
      ? bnFloor(this.availableFunds.div(this.periodPrice()))
      : bn(0)
  }

  @Column(DataType.VIRTUAL)
  get periodsSinceLastPayout (): BigNumber {
    // Date.now = ms
    // this.lastPayout.getTime = ms
    // this.billingPeriod = seconds ==> * 1000
    return bnFloor(bn(Date.now() - this.lastPayout.getTime()).div(this.billingPeriod.times(1000)))
  }

  @Column(DataType.VIRTUAL)
  get toBePayedOut (): BigNumber {
    const amountToPay = this.periodsSinceLastPayout.times(this.periodPrice())
    return amountToPay.lte(this.availableFunds)
      ? amountToPay
      : this.availableFunds
  }

  @Column(DataType.VIRTUAL)
  get hasSufficientFunds (): boolean {
    return this.availableFunds.minus(this.toBePayedOut).gte(this.periodPrice())
  }

  @Column(DataType.VIRTUAL)
  get expiredIn (): BigNumber {
    if (!this.hasSufficientFunds) return bn(0)
    const availableFundsAfterPayout = this.availableFunds.minus(this.toBePayedOut)

    return bnFloor(availableFundsAfterPayout.div(this.periodPrice())).times(this.billingPeriod.div(60)) // in minutes
  }
}
