import config from 'config'
import { promises as fs } from 'fs'
import path from 'path'
import { getObject } from 'sequelize-store'

import { AppOptions, Logger, Strategy } from './definitions'
import { loggingFactory } from './logger'
import { EventProcessor } from './processor'
import { BlockchainEventsProcessor } from './processor/blockchain-events'
import { ProviderManager } from './providers'
import { IpfsProvider } from './providers/ipfs'
import { initStore } from './store'
import { sequelizeFactory } from './sequelize'

const defaultStrategy = (): Strategy => {
  // TODO get strategy from config when confirm with config structure for strategy
  // if (config.has('strategy'))
  return Strategy.Blockchain
}

export default class PinningService {
  static strategy: Strategy = defaultStrategy()

  private readonly manager: ProviderManager
  private eventProcessor: EventProcessor
  private logger: Logger

  public options: AppOptions | undefined
  public offerId: string

  constructor (offerId: string, options?: AppOptions) {
    if (!offerId) throw new Error('Offer id is required')

    this.logger = loggingFactory()
    this.manager = new ProviderManager()
    this.offerId = offerId
    this.options = options

    switch (PinningService.strategy) {
      case Strategy.Blockchain:
        this.eventProcessor = new BlockchainEventsProcessor(offerId, this.manager, options)
        break
      default:
        this.eventProcessor = new BlockchainEventsProcessor(offerId, this.manager, options)
    }
  }

  static setStrategy (strategy: Strategy): void {
    PinningService.strategy = strategy
  }

  async initProviderManger (): Promise<void> {
    const ipfs = await IpfsProvider.bootstrap(config.get<string>('ipfs.connection'))
    this.manager.register(ipfs)
  }

  async initDb (): Promise<void> {
    const sequelize = await sequelizeFactory(config.get<string>('db'))
    await initStore(sequelize)
  }

  async init (): Promise<void> {
    if (this.options?.removeCache) {
      await fs
        .unlink(path.join(process.cwd(), config.get<string>('db')))
        .catch(e => this.logger.info(e.message))
    }

    await this.initDb()
    await this.initProviderManger()

    await this.eventProcessor.initialize()

    // If not set then it is first time running ==> precache
    if (!getObject().lastFetchedBlockNumber && !this.options?.forcePrecache) {
      await this.eventProcessor.precache()
    }
  }

  async start (): Promise<void> {
    await this.eventProcessor.run()
  }

  stop (): void {
    this.eventProcessor.stop()
  }
}
