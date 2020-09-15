import Sequelize, { QueryInterface } from 'sequelize'
import { Sequelize as SequelizeTs } from 'sequelize-typescript'

const schema = {
  id: {
    type: Sequelize.INTEGER,
    field: 'id',
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  code: {
    type: Sequelize.STRING(20),
    field: 'code',
    allowNull: false
  },
  agreementReference: {
    type: Sequelize.STRING(67),
    field: 'agreementReference',
    allowNull: false
  },
  message: {
    type: Sequelize.TEXT,
    field: 'message',
    allowNull: false
  }
}

export default {
  // eslint-disable-next-line require-await
  async up (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    return queryInterface.createTable('message', schema)
  },
  // eslint-disable-next-line require-await
  async down (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    return queryInterface.dropTable('message')
  }
}
