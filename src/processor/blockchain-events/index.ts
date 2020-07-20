import type { Eth } from 'web3-eth'
import { AbiItem } from 'web3-utils'
import { getObject } from 'sequelize-store'

import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import offer from './offer'
import agreement from './agreement'
import { EventProcessor } from '../index'
import { filterBlockchainEvents, getProcessor, isEventWithProvider } from '../../utils'
import { BaseEventsEmitter } from '../../blockchain/events'
import { ethFactory, getEventsEmitter, getNewBlockEmitter } from '../../blockchain/utils'
import { loggingFactory } from '../../logger'
import Agreement from '../../models/agreement.model'
import { BlockchainAgreementEvents, BlockchainEventsWithProvider } from '../../definitions'
import { collectPinsClosure } from '../../gc'
import { AutoStartStopEventEmitter } from '../../blockchain/new-block-emitters'

import type {
  AppOptions,
  BlockchainEvent,
  BlockchainEventProcessorOptions,
  Logger,
  EventsHandler,
  Processor
} from '../../definitions'
import type { ProviderManager } from '../../providers'

const logger: Logger = loggingFactory('processor:blockchain')

export class BlockchainEventsProcessor extends EventProcessor {
  private readonly handlers = [offer, agreement] as EventsHandler<BlockchainEvent, BlockchainEventProcessorOptions>[]
  private readonly processor: Processor<BlockchainEvent>

  private readonly eth: Eth
  private eventsEmitter: BaseEventsEmitter | undefined
  private newBlockEmitter: AutoStartStopEventEmitter | undefined

  constructor (offerId: string, manager: ProviderManager, options?: AppOptions) {
    super(offerId, manager, options)

    this.eth = ethFactory()
    const processorOptions = {
      processorDeps: { manager: this.manager, eth: this.eth },
      errorHandler: this.errorHandler,
      errorLogger: logger
    }
    this.processor = this.filterEvents(this.offerId, getProcessor(this.handlers, processorOptions))
  }

  filterEvents (offerId: string, callback: Processor<BlockchainEvent>): Processor<BlockchainEvent> {
    return async (event: BlockchainEvent): Promise<void> => {
      logger.debug(`Got ${event.event} for provider ${(event as BlockchainEventsWithProvider).returnValues.provider}`)

      if (isEventWithProvider(event) && event.returnValues.provider === offerId) {
        return callback(event)
      }

      if (event.event.startsWith('Agreement') && await Agreement.findByPk((event as BlockchainAgreementEvents).returnValues.agreementReference)) {
        return callback(event)
      }

      return Promise.resolve()
    }
  }

  async initialize (): Promise<void> {
    if (this.initialized) throw new Error('Already Initialized')

    this.newBlockEmitter = getNewBlockEmitter(this.eth)
    this.eventsEmitter = getEventsEmitter(
      this.eth,
      storageManagerContractAbi.abi as AbiItem[],
      { newBlockEmitter: this.newBlockEmitter, contractAddress: this.options?.contractAddress }
    )
    this.initialized = true
    return await Promise.resolve()
  }

  async run (): Promise<void> {
    if (!this.initialized) await this.initialize()

    // If not set then it is first time running ==> precache
    if (!getObject().lastFetchedBlockNumber && !this.options?.forcePrecache) {
      await this.precache()
    }

    this.eventsEmitter?.on('error', (e: Error) => {
      logger.error(`There was unknown error in the blockchain's Events Emitter! ${e}`)
    })

    // Listen on Offer events
    this.eventsEmitter?.on('newEvent', this.processor)

    // Pinning Garbage Collecting
    this.newBlockEmitter?.on('newBlock', this.errorHandler(collectPinsClosure(this.manager), loggingFactory('gc')))
  }

  async precache (): Promise<void> {
    if (!this.initialized) await this.initialize()

    const precacheLogger = loggingFactory('processor:blockchain:precache')
    const _eventsEmitter = this.eventsEmitter
    const processorOptions = { processorDeps: { eth: this.eth }, errorHandler: this.options?.errorHandler, logger: precacheLogger }
    const processor = filterBlockchainEvents(this.offerId, getProcessor(this.handlers, processorOptions))

    // Wait to build up the database with latest data
    precacheLogger.verbose('Populating database')

    await new Promise<void>((resolve, reject) => {
      const dataQueue: BlockchainEvent[] = []
      const dataQueuePusher = (event: BlockchainEvent): void => { dataQueue.push(event) }

      _eventsEmitter?.on('initFinished', async function () {
        _eventsEmitter?.off('newEvent', dataQueuePusher)
        // Needs to be sequentially processed
        try {
          for (const event of dataQueue) {
            await processor(event)
          }
          resolve()
        } catch (e) {
          reject(e)
        }
      })
      _eventsEmitter?.on('newEvent', dataQueuePusher)
    })

    // Now lets pin every Agreement that has funds
    precacheLogger.info('Pinning valid Agreements')
    for (const agreement of await Agreement.findAll()) {
      if (agreement.hasSufficientFunds) {
        await this.manager.pin(agreement.dataReference, agreement.size)
      }
    }
  }

  async stop (): Promise<void> {
    if (!this.eventsEmitter && !this.eventsEmitter) throw new Error('No process running')
    this.eventsEmitter?.stop()
    this.newBlockEmitter?.stop()
    return await Promise.resolve()
  }
}
