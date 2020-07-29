import config from 'config'
import { promises as fs } from 'fs'
import path from 'path'

import { AppOptions, Strategy } from './definitions'
import { loggingFactory } from './logger'
import { BlockchainEventsProcessor } from './processor/blockchain-events'
import { MarketplaceEventsProcessor } from './processor/marketplace-events'
import { ProviderManager } from './providers'
import { IpfsProvider } from './providers/ipfs'
import { sequelizeFactory } from './sequelize'
import { initStore } from './store'
import { duplicateObject } from './utils'

const logger = loggingFactory('pinning-service')

function getEventProcessor (offerId: string, manager: ProviderManager, options?: AppOptions): BlockchainEventsProcessor | MarketplaceEventsProcessor {
  const strategy = options?.strategy ?? config.get('strategy')

  switch (strategy) {
    case Strategy.Blockchain:
      logger.info('Create BlockchainEventsProcessor')
      return new BlockchainEventsProcessor(offerId, manager, options)
    case Strategy.Marketplace:
      logger.info('Create MarketplaceEventsProcessor')
      return new MarketplaceEventsProcessor(offerId, manager, options)
    default:
      logger.info('Create default(BlockchainEventsProcessor)')
      return new BlockchainEventsProcessor(offerId, manager, options)
  }
}

export default async (offerId: string, options: AppOptions): Promise<{ stop: () => void }> => {
  // dataDir is set when entry point is CLI, for testing we have also the CWD option.
  const dbPath = path.join(options?.dataDir, config.get<string>('db'))
  logger.verbose(`Using database path ${dbPath}`)

  // Initialize DB
  if (options?.removeCache) {
    // dataDir is set when entry point is CLI, for testing we have also the CWD option.
    await fs
      .unlink(dbPath)
      .catch(e => logger.error(e.message))
  }
  const sequelize = await sequelizeFactory(dbPath)
  await initStore(sequelize)
  logger.info('DB initialized')

  // Initialize Provider Manager
  const providerManager = new ProviderManager()
  const ipfs = await IpfsProvider.bootstrap(duplicateObject(config.get<string>('ipfs.clientOptions')), config.get<number|string>('ipfs.sizeFetchTimeout'))
  providerManager.register(ipfs)
  logger.info('IPFS provider initialized')

  // Start listening for events
  const eventProcessor = getEventProcessor(offerId, providerManager, options)
  await eventProcessor.initialize()
  await eventProcessor.run()
  logger.info('Event processor initialized')

  return { stop: (): Promise<void> => eventProcessor.stop() }
}
