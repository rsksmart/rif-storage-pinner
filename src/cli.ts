import { Command, flags } from '@oclif/command'
import type { Input, OutputFlags } from '@oclif/parser'
import config from 'config'
import path from 'path'
import { promises as fs } from 'fs'
import type { AbiItem } from 'web3-utils'

import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import { sequelizeFactory } from './sequelize'
import { initStore } from './store'
import { ethFactory, getEventsEmitter } from './blockchain/utils'
import { errorHandler, filterEvents } from './utils'
import process, { precache } from './processor'
import { loggingFactory } from './logger'
import { getObject } from 'sequelize-store'

export default class PinningServiceCommand extends Command {
  static flags = {
    offerId: flags.string({
      char: 'o',
      description: 'offer to which should the service listen to',
      env: 'RIFS_OFFER',
      required: true
    }),
    network: flags.string({
      char: 'n',
      description: 'path to JSON config file to load',
      options: ['testnet', 'mainnet'],
      env: 'RIFS_NETWORK'
    }),
    'remove-cache': flags.boolean({
      description: 'removes the local databse'
    }),
    config: flags.string({
      description: 'path to JSON config file to load',
      hidden: true,
      env: 'RIFS_CONFIG'
    }),
    log: flags.string({
      description: 'what level of information to log',
      options: ['error', 'warn', 'info', 'verbose', 'debug'],
      default: 'error',
      env: 'LOG_LEVEL'
    }),
    'log-filter': flags.string(
      {
        description: 'what components should be logged (+-, chars allowed)'
      }
    ),
    'log-path': flags.string(
      {
        description: 'log to file, default is STDOUT'
      }
    )
  }

  async run () {
    const { flags: originalFlags } = this.parse(this.constructor as Input<typeof PinningServiceCommand.flags>)
    const flags = originalFlags as OutputFlags<typeof PinningServiceCommand.flags>

    const logObject = {
      log: {
        level: flags.log,
        filter: flags['log-filter'] || null,
        path: flags['log-path'] || null
      }
    }

    if (flags.config) {
      config.util.extendDeep(config, config.util.parseFile(flags.config))
    }
    config.util.extendDeep(config, logObject)

    if (flags.network) {
      const networkConfigPath = path.join(__dirname, '..', 'config', `${flags.network}.json5`)
      config.util.extendDeep(config, config.util.parseFile(networkConfigPath))
    }

    if (!config.has('blockchain.contractAddress')) {
      throw new Error('You have to specify address of smart contract! Use --network flag!')
    }

    const dbFile = path.join(this.config.dataDir, 'db.sqlite')

    if (flags['remove-cache']) {
      await fs.unlink(dbFile)
    }

    const sequelize = await sequelizeFactory(dbFile)
    await initStore(sequelize)
    const store = getObject()

    const eth = ethFactory()
    const eventEmitter = getEventsEmitter(eth, storageManagerContractAbi.abi as AbiItem[])
    const processor = filterEvents(flags.offerId, errorHandler(process(eth), loggingFactory('processor')))

    // If not set then it is first time running ==> precache
    if (!store.lastFetchedBlockNumber) {
      await precache(eventEmitter, processor)
    }

    eventEmitter.on('newEvent', processor)
  }
}
