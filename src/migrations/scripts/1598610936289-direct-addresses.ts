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
  peerId: {
    type: Sequelize.TEXT,
    field: 'peerId',
    allowNull: false
  },
  agreementReference: {
    type: Sequelize.TEXT,
    field: 'agreementReference',
    allowNull: false
  },
  createdAt: {
    type: Sequelize.DATE,
    field: 'createdAt',
    allowNull: false
  },
  updatedAt: {
    type: Sequelize.DATE,
    field: 'updatedAt',
    allowNull: false
  }
}

export default {
  // eslint-disable-next-line require-await
  async up (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    return queryInterface.createTable('direct-address', schema)
  },
  // eslint-disable-next-line require-await
  async down (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    return queryInterface.dropTable('direct-address')
  }
}
