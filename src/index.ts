import config from 'config'

import { loggingFactory } from './logger'
import { BlockchainEventsProcessor } from './processor/blockchain-events'
import { MarketplaceEventsProcessor } from './processor/marketplace-events'
import { ProviderManager } from './providers'
import { IpfsProvider } from './providers/ipfs'
import { duplicateObject } from './utils'
import { JobsManager } from './jobs-manager'
import { start as startCommunication, stop as stopCommunication } from './communication'
import { Strategy } from './definitions'
import type { AppOptions, JobManagerOptions } from './definitions'

const logger = loggingFactory('pinning-service')

function getEventProcessor (offerId: string, manager: ProviderManager, options: AppOptions): BlockchainEventsProcessor | MarketplaceEventsProcessor {
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

export async function initApp (offerId: string, options: AppOptions): Promise<{ stop: () => void }> {
  const jobsOptions = config.get<JobManagerOptions>('jobs')
  const jobsManager = new JobsManager(jobsOptions)

  // Initialize Communication channel
  await startCommunication(offerId, options.contractAddress)

  // Initialize Provider Manager
  const providerManager = new ProviderManager()
  const ipfs = await IpfsProvider.bootstrap(jobsManager, duplicateObject(config.get<string>('ipfs.clientOptions')))
  providerManager.register(ipfs)
  logger.info('IPFS provider initialized')

  // Start listening for events
  const eventProcessor = getEventProcessor(offerId, providerManager, options)
  await eventProcessor.initialize()
  await eventProcessor.run()
  logger.info('Event processor initialized')

  return {
    stop: async (): Promise<void> => {
      await eventProcessor.stop()
      await stopCommunication()
    }
  }
}
