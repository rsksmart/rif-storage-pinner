import { QueryInterface } from 'sequelize'
import { Sequelize as SequelizeTs } from 'sequelize-typescript'

export default {
  // eslint-disable-next-line require-await
  async up (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    const transaction = await sequelize.transaction()
    try {
      await sequelize.query('UPDATE "data-store" SET value = lower(value) WHERE key = "offerId"', { transaction })
      await sequelize.query('UPDATE storage_agreement SET consumer = lower(consumer), tokenAddress = lower(tokenAddress)', { transaction })

      await transaction.commit()
    } catch (e) {
      await transaction.rollback()
      throw e
    }
  },
  // eslint-disable-next-line require-await
  async down (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    return Promise.resolve()
  }
}
