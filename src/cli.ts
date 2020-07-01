import { Command, flags } from '@oclif/command'
import type { Input, OutputFlags } from '@oclif/parser'
import config from 'config'
import path from 'path'
import { promises as fs } from 'fs'
import type { AbiItem } from 'web3-utils'
import type { EventData } from 'web3-eth-contract'
import type { Eth } from 'web3-eth'

import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import { sequelizeFactory } from './sequelize'
import { initStore } from './store'
import { ethFactory, getEventsEmitter } from './blockchain/utils'
import { errorHandler, filterEvents } from './utils'
import process, { precache } from './processor'
import { loggingFactory } from './logger'
import { getObject } from 'sequelize-store'
import { IpfsProvider } from './providers/ipfs'
import { ProviderManager } from './providers'
import { Config } from './definitions'

const logger = loggingFactory()

function getProcessor (offerId: string, eth: Eth, manager?: ProviderManager): (event: EventData) => Promise<void> {
  return filterEvents(offerId, errorHandler(process(eth, manager), loggingFactory('processor')))
}

export default class PinningServiceCommand extends Command {
  static flags = {
    offerId: flags.string({
      char: 'o',
      description: 'ID of Offer to which should the service listen to',
      env: 'RIFS_OFFER',
      required: true
    }),
    network: flags.string({
      char: 'n',
      description: 'specifies to which network is the provider connected',
      options: ['testnet', 'mainnet'],
      env: 'RIFS_NETWORK'
    }),
    provider: flags.string({
      char: 'p',
      description: 'URL to blockchain node provider',
      env: 'RIFS_PROVIDER'
    }),
    'remove-cache': flags.boolean({
      description: 'removes the local database'
    }),
    config: flags.string({
      description: 'path to JSON config file to load',
      hidden: true,
      env: 'RIFS_CONFIG'
    }),
    ipfs: flags.string({
      description: 'specifies a connection URL to IPFS node. Default is go-ipfs listening configuration.',
      env: 'RIFS_IPFS'
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

  private configSetup (flags: OutputFlags<typeof PinningServiceCommand.flags>): void {
    const configObject: Config = {
      log: {
        level: flags.log,
        filter: flags['log-filter'] || null,
        path: flags['log-path'] || null
      }
    }

    if (flags.provider) {
      configObject.blockchain = { provider: flags.provider }
    }

    if (flags.config) {
      config.util.extendDeep(config, config.util.parseFile(flags.config))
    }
    config.util.extendDeep(config, configObject)

    if (flags.network) {
      const networkConfigPath = path.join(__dirname, '..', 'config', `${flags.network}.json5`)
      config.util.extendDeep(config, config.util.parseFile(networkConfigPath))
    }

    if (!config.has('blockchain.contractAddress')) {
      throw new Error('You have to specify address of smart contract! Use --network flag!')
    }
  }

  async run () {
    const { flags: originalFlags } = this.parse(this.constructor as Input<typeof PinningServiceCommand.flags>)
    const flags = originalFlags as OutputFlags<typeof PinningServiceCommand.flags>
    this.configSetup(flags)

    const dbFile = path.join(this.config.dataDir, 'db.sqlite')

    if (flags['remove-cache']) {
      await fs.unlink(dbFile)
    }

    const sequelize = await sequelizeFactory(dbFile)
    await initStore(sequelize)
    const store = getObject()

    const manager = new ProviderManager()

    const ipfs = await IpfsProvider.bootstrap(flags.ipfs)
    manager.register(ipfs)

    const eth = ethFactory()
    const eventEmitter = getEventsEmitter(eth, storageManagerContractAbi.abi as AbiItem[])

    eventEmitter.on('error', (e: Error) => {
      logger.error(`There was unknown error in the blockchain's Events Emitter! ${e}`)
    })

    // If not set then it is first time running ==> precache
    if (!store.lastFetchedBlockNumber) {
      await precache(eventEmitter, manager, getProcessor(flags.offerId, eth))
    }

    eventEmitter.on('newEvent', getProcessor(flags.offerId, eth, manager))
  }
}
