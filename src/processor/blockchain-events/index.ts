import type { Eth } from 'web3-eth'
import { AbiItem } from 'web3-utils'

import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import offer from './offer'
import agreement from './agreement'
import { EventProcessor } from '../index'
import { filterEvents, getProcessor } from '../../utils'
import { BaseEventsEmitter } from '../../blockchain/events'
import { ethFactory, getEventsEmitter } from '../../blockchain/utils'
import {
  AppOptions, BlockchainAgreementEvents,
  BlockchainEvent,
  BlockchainEventProcessorOptions,
  BlockchainOfferEvents,
  Logger
} from '../../definitions'
import { loggingFactory } from '../../logger'
import Agreement from '../../models/agreement.model'

import type { Handler, Processor } from '../../definitions'
import type { ProviderManager } from '../../providers'

const HANDLERS: Handler<BlockchainAgreementEvents & BlockchainOfferEvents, BlockchainEventProcessorOptions>[] = [offer, agreement]

export class BlockchainEventsProcessor extends EventProcessor {
  private logger: Logger = loggingFactory('processor:blockchain')

  private eventsEmitter: BaseEventsEmitter | undefined
  private readonly processor: Processor<BlockchainEvent>
  private readonly eth: Eth

  constructor (offerId: string, manager: ProviderManager, options?: AppOptions) {
    super(offerId, manager, options)

    this.eth = ethFactory()
    const processorOptions = { processorDeps: { manager: this.manager, eth: this.eth }, errorHandler: this.options?.errorHandler, logger: this.logger }
    this.processor = filterEvents(this.offerId, getProcessor(HANDLERS, processorOptions))
  }

  initialize (): Promise<void> {
    if (this.initialized) Promise.reject(new Error('Already Initialized'))

    this.eventsEmitter = getEventsEmitter(this.eth, storageManagerContractAbi.abi as AbiItem[], { contractAddress: this.options?.contractAddress })
    this.initialized = true
    return Promise.resolve()
  }

  async run (): Promise<void> {
    if (!this.initialized) await this.initialize()

    this.eventsEmitter?.on('error', (e: Error) => {
      this.logger.error(`There was unknown error in the blockchain's Events Emitter! ${e}`)
    })

    this.eventsEmitter?.on('newEvent', this.processor)
  }

  async precache (): Promise<void> {
    if (!this.initialized) await this.initialize()

    const precacheLogger = loggingFactory('processor:blockchain:precache')
    const _eventsEmitter = this.eventsEmitter
    const processorOptions = { processorDeps: { eth: this.eth }, errorHandler: this.options?.errorHandler, logger: precacheLogger }
    const processor = filterEvents(this.offerId, getProcessor(HANDLERS, processorOptions))

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
    precacheLogger.verbose('Pinning valid Agreements')
    for (const agreement of await Agreement.findAll()) {
      if (agreement.hasSufficientFunds) {
        await this.manager.pin(agreement.dataReference, agreement.size)
      }
    }
  }

  stop (): void {
    if (!this.eventsEmitter) throw new Error('No processor running')
    this.eventsEmitter.stop()
  }
}
