import config from 'config'
import { promises as fs } from 'fs'
import path from 'path'

import { AppOptions, Logger, Strategy } from './definitions'
import { loggingFactory } from './logger'
import { EventProcessor } from './processor'
import { BlockchainEventsProcessor } from './processor/blockchain-events'
import { CacheEventsProcessor } from './processor/cache-events'
import { ProviderManager } from './providers'
import { IpfsProvider } from './providers/ipfs'
import { initStore } from './store'
import { sequelizeFactory } from './sequelize'

export default class PinningService {
  private readonly strategy: Strategy
  private readonly manager: ProviderManager
  private eventProcessor: EventProcessor
  private logger: Logger

  public options: AppOptions | undefined
  public offerId: string

  static async initDb (): Promise<void> {
    const sequelize = await sequelizeFactory(config.get<string>('db'))
    await initStore(sequelize)
  }

  constructor (offerId: string, options?: AppOptions) {
    if (!offerId) throw new Error('Offer id is required')

    this.strategy = options?.strategy ?? config.get('strategy')
    this.logger = loggingFactory('pinning-service')
    this.manager = new ProviderManager()
    this.offerId = offerId
    this.options = options

    switch (this.strategy) {
      case Strategy.Blockchain:
        this.logger.info('Create BlockchainEventsProcessor')
        this.eventProcessor = new BlockchainEventsProcessor(offerId, this.manager, options)
        break
      case Strategy.Cache:
        this.logger.info('Create CacheEventsProcessor')
        this.eventProcessor = new CacheEventsProcessor(offerId, this.manager, options)
        break
      default:
        this.logger.info('Create default(BlockchainEventsProcessor)')
        this.eventProcessor = new BlockchainEventsProcessor(offerId, this.manager, options)
    }
  }

  private async initProviderManger (): Promise<void> {
    const ipfs = await IpfsProvider.bootstrap(config.get<string>('ipfs.connection'))
    this.manager.register(ipfs)
  }

  async init (): Promise<void> {
    if (this.options?.removeCache) {
      await fs
        .unlink(path.join(process.cwd(), config.get<string>('db')))
        .catch(e => this.logger.info(e.message))
    }

    await PinningService.initDb()
    this.logger.info('DB initialized')
    await this.initProviderManger()
    this.logger.info('IPFS provider initialized')
    await this.eventProcessor.initialize()
    this.logger.info('Event processor initialized')
  }

  async start (): Promise<void> {
    await this.eventProcessor.run()
  }

  async stop (): Promise<void> {
    await this.eventProcessor.stop()
  }
}
