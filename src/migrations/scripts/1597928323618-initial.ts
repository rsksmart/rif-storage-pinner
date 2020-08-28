import Sequelize, { QueryInterface } from 'sequelize'
import { Sequelize as SequelizeTs } from 'sequelize-typescript'

/**
 * Actions summary:
 *
 * createTable "event", deps: []
 * createTable "storage_offer", deps: []
 * createTable "rates", deps: []
 * createTable "rns_transfer", deps: []
 * createTable "rns_domain", deps: []
 * createTable "rns_domain_expiration", deps: [rns_domain]
 * createTable "rns_sold-domain", deps: [rns_domain]
 * createTable "rns_domain-offer", deps: [rns_domain]
 * createTable "storage_agreement", deps: [storage_offer]
 * createTable "storage_billing-plan", deps: [storage_offer]
 * createTable "rns_owner", deps: [rns_domain]
 * addIndex "event_transaction_hash_log_index" to table "event"
 *
 **/
type Commands = { fn: keyof QueryInterface, [key: string]: any }[]

function migrationCommands (transaction: any): Commands {
  return [
    {
      fn: 'createTable',
      params: [
        'event',
        {
          id: {
            type: Sequelize.INTEGER,
            field: 'id',
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
          },
          blockNumber: {
            type: Sequelize.INTEGER,
            field: 'blockNumber'
          },
          transactionHash: {
            type: Sequelize.STRING(66),
            field: 'transactionHash'
          },
          logIndex: {
            type: Sequelize.INTEGER,
            field: 'logIndex'
          },
          targetConfirmation: {
            type: Sequelize.INTEGER,
            field: 'targetConfirmation'
          },
          contractAddress: {
            type: Sequelize.STRING(66),
            field: 'contractAddress'
          },
          event: {
            type: Sequelize.TEXT,
            field: 'event'
          },
          content: {
            type: Sequelize.TEXT,
            field: 'content'
          },
          emitted: {
            type: Sequelize.BOOLEAN,
            field: 'emitted',
            defaultValue: false
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
        },
        {
          transaction: transaction
        }
      ]
    },
    {
      fn: 'createTable',
      params: [
        'direct-address',
        {
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
        },
        {
          transaction: transaction
        }
      ]
    },
    {
      fn: 'createTable',
      params: [
        'storage_agreement',
        {
          agreementReference: {
            type: Sequelize.STRING(67),
            field: 'agreementReference',
            allowNull: false,
            primaryKey: true
          },
          dataReference: {
            type: Sequelize.STRING,
            field: 'dataReference',
            allowNull: false
          },
          consumer: {
            type: Sequelize.STRING(64),
            field: 'consumer',
            allowNull: false
          },
          size: {
            type: Sequelize.STRING,
            field: 'size',
            allowNull: false
          },
          isActive: {
            type: Sequelize.BOOLEAN,
            field: 'isActive',
            defaultValue: true
          },
          billingPeriod: {
            type: Sequelize.STRING,
            field: 'billingPeriod',
            allowNull: false
          },
          billingPrice: {
            type: Sequelize.STRING,
            field: 'billingPrice',
            allowNull: false
          },
          availableFunds: {
            type: Sequelize.STRING,
            field: 'availableFunds',
            allowNull: false
          },
          lastPayout: {
            type: Sequelize.DATE,
            field: 'lastPayout',
            allowNull: false
          },
          expiredAtBlockNumber: {
            type: Sequelize.NUMBER,
            field: 'expiredAtBlockNumber'
          }
        },
        {
          transaction: transaction
        }
      ]
    },
    {
      fn: 'createTable',
      params: [
        'jobs',
        {
          id: {
            type: Sequelize.INTEGER,
            field: 'id',
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
          },
          name: {
            type: Sequelize.STRING,
            field: 'name',
            allowNull: false
          },
          state: {
            type: Sequelize.ENUM('created', 'backoff', 'running', 'errored', 'finished'),
            field: 'state',
            defaultValue: 'created',
            allowNull: false
          },
          tries: {
            type: Sequelize.INTEGER,
            field: 'tries',
            defaultValue: 1,
            allowNull: false
          },
          type: {
            type: Sequelize.STRING,
            field: 'type'
          },
          start: {
            type: Sequelize.DATE,
            field: 'start'
          },
          finish: {
            type: Sequelize.DATE,
            field: 'finish'
          },
          retry: {
            type: Sequelize.STRING,
            field: 'retry'
          },
          errorMessage: {
            type: Sequelize.STRING,
            field: 'errorMessage'
          }
        },
        {
          transaction: transaction
        }
      ]
    },
    {
      fn: 'addIndex',
      params: [
        'event',
        ['transactionHash', 'logIndex'],
        {
          indexName: 'event_transaction_hash_log_index',
          name: 'event_transaction_hash_log_index',
          indicesType: 'UNIQUE',
          type: 'UNIQUE',
          transaction: transaction
        }
      ]
    }
  ]
}

function rollbackCommands (transaction: any): Commands {
  return [
    {
      fn: 'dropTable',
      params: [
        'event', {
          transaction: transaction
        }
      ]
    },
    {
      fn: 'dropTable',
      params: [
        'storage_agreement', {
          transaction: transaction
        }
      ]
    },
    {
      fn: 'dropTable',
      params: [
        'jobs', {
          transaction: transaction
        }
      ]
    },
    {
      fn: 'dropTable',
      params: [
        'direct-address', {
          transaction: transaction
        }
      ]
    }
  ]
}

function run (queryInterface: QueryInterface, _commands: (transaction: any) => Commands) {
  return async function (transaction: any): Promise<void> {
    for (const command of _commands(transaction)) {
      // @ts-ignore
      // eslint-disable-next-line prefer-spread
      await queryInterface[command.fn].apply(queryInterface, command.params)
    }
  }
}

export default {
  async up (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    await queryInterface.sequelize.transaction(run(queryInterface, migrationCommands))
  },
  async down (queryInterface: QueryInterface, sequelize: SequelizeTs): Promise<void> {
    await queryInterface.sequelize.transaction(run(queryInterface, rollbackCommands))
  }
}
