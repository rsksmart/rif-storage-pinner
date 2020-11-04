import Sequelize, { QueryInterface } from 'sequelize'
import { Sequelize as SequelizeTs } from 'sequelize-typescript'

export default {
  async up (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    await queryInterface.addColumn('storage_agreement', 'tokenAddress', Sequelize.STRING)
    await queryInterface.addColumn('jobs', 'agreementReference', Sequelize.STRING)
    await queryInterface.addConstraint('jobs',
      {
        type: 'foreign key',
        fields: ['agreementReference'],
        onUpdate: 'CASCADE',
        onDelete: 'NO ACTION',
        references: {
          table: 'storage_agreement',
          field: 'agreementReference'
        }
      }
    )
  },
  async down (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    await queryInterface.removeColumn('storage_agreement', 'tokenAddress')
    await queryInterface.removeColumn('jobs', 'agreementReference')
  }
}
