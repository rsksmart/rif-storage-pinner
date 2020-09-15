import type { Eth } from 'web3-eth'
import { AbiItem } from 'web3-utils'
import { getObject } from 'sequelize-store'
import config from 'config'

import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import offer from './offer'
import agreement from './agreement'
import { EventProcessor } from '../index'
import { errorHandler as originalErrorHandler, isEventWithProvider } from '../../utils'
import { ethFactory, getEventsEmitter, getNewBlockEmitter } from '../../blockchain/utils'
import { loggingFactory } from '../../logger'
import Agreement from '../../models/agreement.model'
import gcHanlder from '../../gc'
import type { BaseEventsEmitter } from '../../blockchain/events'
import type { AutoStartStopEventEmitter } from '../../blockchain/new-block-emitters'

import type {
  AppOptions,
  BlockchainEvent,
  BlockchainEventProcessorOptions,
  Logger,
  EventsHandler,
  Processor,
  BlockchainAgreementEvents,
  BlockchainEventsWithProvider
} from '../../definitions'
import type { ProviderManager } from '../../providers'

const logger: Logger = loggingFactory('processor:blockchain')

function filterBlockchainEvents (offerId: string, callback: Processor<BlockchainEvent>): Processor<BlockchainEvent> {
  return async (event: BlockchainEvent): Promise<void> => {
    logger.debug(`Got ${event.event} for provider ${(event as BlockchainEventsWithProvider).returnValues.provider}`)

    if (isEventWithProvider(event) && event.returnValues.provider === offerId) {
      return callback(event)
    }

    if (event.event.startsWith('Agreement') && await Agreement.findByPk((event as BlockchainAgreementEvents).returnValues.agreementReference)) {
      return callback(event)
    }

    logger.debug(`Events not related to offer ${offerId}`)
  }
}

export class BlockchainEventsProcessor extends EventProcessor {
  private readonly handlers = [offer, agreement] as EventsHandler<BlockchainEvent, BlockchainEventProcessorOptions>[]
  private readonly processor: Processor<BlockchainEvent>

  private readonly errorHandler: (fn: (...args: any[]) => Promise<void>, logger: Logger) => (...args: any[]) => Promise<void>
  private readonly manager: ProviderManager
  private readonly eth: Eth
  private eventsEmitter: BaseEventsEmitter | undefined
  private newBlockEmitter: AutoStartStopEventEmitter | undefined
  private appResetCallback: () => void

  constructor (offerId: string, manager: ProviderManager, options: AppOptions) {
    super(offerId, options)

    if (!options?.appResetCallback) {
      throw new Error('We need appResetCallback to be defined for BlockchainEventsProcessor!')
    }

    this.appResetCallback = options.appResetCallback
    this.manager = manager
    this.errorHandler = options?.errorHandler ?? originalErrorHandler
    this.eth = ethFactory()
    const deps: BlockchainEventProcessorOptions = {
      manager: manager,
      eth: this.eth
    }
    this.processor = filterBlockchainEvents(this.offerId,
      this.errorHandler(this.getProcessor<BlockchainEvent, BlockchainEventProcessorOptions>(this.handlers, deps), logger)
    )
  }

  // eslint-disable-next-line require-await
  async initialize (): Promise<void> {
    if (this.initialized) throw new Error('Already Initialized')

    const networkId = config.get<string|number>('blockchain.networkId')

    if (networkId !== '*' && networkId !== await this.eth.net.getId()) {
      throw new Error(`Network ID not defined or incorrect. Expected ${networkId}, got ${await this.eth.net.getId()}`)
    }

    this.newBlockEmitter = getNewBlockEmitter(this.eth)
    this.eventsEmitter = getEventsEmitter(
      this.eth,
      storageManagerContractAbi.abi as AbiItem[],
      { newBlockEmitter: this.newBlockEmitter, contractAddress: this.options?.contractAddress }
    )
    this.initialized = true
  }

  async run (): Promise<void> {
    if (!this.initialized) await this.initialize()

    // If not set then it is first time running ==> precache
    if (!getObject().lastFetchedBlockNumber || this.options?.forcePrecache) {
      await this.precache()
    }

    this.eventsEmitter?.on('error', (e: Error) => {
      logger.error(`There was unknown error in the blockchain's Events Emitter! ${e}`)
    })

    // Listen on Offer events
    this.eventsEmitter?.on('newEvent', this.processor)

    // Listening for reorgs outside of confirmations range
    this.eventsEmitter?.on('reorgOutOfRange', this.appResetCallback)

    // Pinning Garbage Collecting
    this.newBlockEmitter?.on('newBlock', this.errorHandler(gcHanlder({ manager: this.manager }), loggingFactory('gc')))
  }

  async precache (): Promise<void> {
    if (!this.initialized) await this.initialize()

    const precacheLogger = loggingFactory('processor:blockchain:precache')
    const _eventsEmitter = this.eventsEmitter
    const _processor = filterBlockchainEvents(this.offerId,
      this.errorHandler(this.getProcessor<BlockchainEvent, BlockchainEventProcessorOptions>(this.handlers, { eth: this.eth }), logger)
    )

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
            await _processor(event)
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
        await this.manager.pin(agreement.dataReference, agreement.size, agreement.agreementReference)
      }
    }
  }

  // eslint-disable-next-line require-await
  async stop (): Promise<void> {
    if (!this.eventsEmitter && !this.eventsEmitter) throw new Error('No process running')
    this.eventsEmitter?.stop()
    this.newBlockEmitter?.stop()
  }
}
