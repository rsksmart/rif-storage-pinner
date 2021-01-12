import Sequelize, { QueryInterface } from 'sequelize'
import { Sequelize as SequelizeTs } from 'sequelize-typescript'

export default {
  // eslint-disable-next-line require-await
  async up (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    await queryInterface.changeColumn('message', 'agreementReference',
      {
        type: Sequelize.STRING(67),
        allowNull: true
      }
    )
  },
  // eslint-disable-next-line require-await
  async down (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    await queryInterface.changeColumn('message', 'agreementReference',
      {
        type: Sequelize.STRING(67),
        allowNull: false
      }
    )
  }
}
