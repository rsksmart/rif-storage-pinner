import Eth from 'web3-eth'
import { AbiItem } from 'web3-utils'
import { getObject } from 'sequelize-store'
import config from 'config'
import {
  Contract,
  AutoEventsEmitter,
  EventsEmitterCreationOptions, LAST_FETCHED_BLOCK_NUMBER_KEY, NEW_BLOCK_EVENT_NAME, NEW_EVENT_EVENT_NAME,
  NewBlockEmitter, NewBlockEmitterOptions, REORG_OUT_OF_RANGE_EVENT_NAME,
  Web3Events
} from '@rsksmart/web3-events'
import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import offer from './offer'
import agreement from './agreement'
import { EventProcessor } from '../index'
import { errorHandler as originalErrorHandler, isEventWithProvider } from '../../utils'
import { loggingFactory } from '../../logger'
import Agreement from '../../models/agreement.model'
import gcHandler from '../../gc'

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
import { EventTransformer, getEventTransformer } from '../../event-transformer'

const logger: Logger = loggingFactory('processor:blockchain')

function ethFactory (): Eth {
  const provider = Eth.givenProvider || config.get('blockchain.provider')
  logger.info(`Connecting to provider ${provider}`)

  return new Eth(provider)
}

function filterAndTransformBlockchainEvents (offerId: string, eventTransformer: EventTransformer, callback: Processor<BlockchainEvent>): Processor<BlockchainEvent> {
  return async (originalEvent: BlockchainEvent): Promise<void> => {
    const event = eventTransformer(originalEvent)
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

function isServiceInitialized (serviceName: string): boolean {
  const store = getObject()
  return store[`web3events.${serviceName}.${LAST_FETCHED_BLOCK_NUMBER_KEY}`] !== undefined
}

export class BlockchainEventsProcessor extends EventProcessor {
  private readonly handlers = [offer, agreement] as EventsHandler<BlockchainEvent, BlockchainEventProcessorOptions>[]
  private readonly processor: Processor<BlockchainEvent>

  private readonly errorHandler: (fn: (...args: any[]) => Promise<void>, logger: Logger) => (...args: any[]) => Promise<void>
  private readonly manager: ProviderManager
  private readonly eth: Eth
  private readonly appResetCallback: () => void
  private readonly contractAddresses: string
  private eventsEmitter?: AutoEventsEmitter<BlockchainEvent>
  private newBlockEmitter?: NewBlockEmitter
  private eventTransformer: EventTransformer

  constructor (offerId: string, manager: ProviderManager, options: AppOptions) {
    super(offerId, options)

    if (!options?.appResetCallback) {
      throw new Error('We need appResetCallback to be defined for BlockchainEventsProcessor!')
    }

    this.contractAddresses = options.contractAddress ?? config.get<string>('blockchain.contractAddress')
    this.appResetCallback = options.appResetCallback
    this.manager = manager
    this.errorHandler = options?.errorHandler ?? originalErrorHandler
    this.eth = ethFactory()
    this.eventTransformer = getEventTransformer<BlockchainEvent>(storageManagerContractAbi.abi as AbiItem[])
    const deps: BlockchainEventProcessorOptions = {
      manager: manager,
      eth: this.eth
    }
    this.processor = filterAndTransformBlockchainEvents(
      this.offerId,
      this.eventTransformer,
      this.errorHandler(this.getProcessor<BlockchainEvent, BlockchainEventProcessorOptions>(this.handlers, deps), logger)
    )
  }

  // eslint-disable-next-line require-await
  async initialize (): Promise<void> {
    if (this.initialized) throw new Error('Already Initialized')

    const logger = loggingFactory('blockchain')
    logger.info('Initializing Blockchain processor')

    const networkId = config.get<string|number>('blockchain.networkId')

    const ethNetworkId = await this.eth.net.getId()
    logger.verbose(`Connected to network ID ${ethNetworkId}`)

    if (networkId !== '*' && networkId !== ethNetworkId) {
      throw new Error(`Network ID not defined or incorrect. Expected ${networkId}, got ${await this.eth.net.getId()}`)
    }

    const web3events = new Web3Events(this.eth, {
      store: getObject('web3events.'),
      logger: loggingFactory('web3events'),
      defaultNewBlockEmitter: config.get<NewBlockEmitterOptions>('blockchain.newBlockEmitter')
    })
    this.newBlockEmitter = web3events.defaultNewBlockEmitter

    const contract = new Contract(storageManagerContractAbi.abi as AbiItem[], this.contractAddresses, 'storage')
    const options = config.get<EventsEmitterCreationOptions>('blockchain.eventsEmitter')

    logger.info(`For listening on service 'blockchain' using contract on address: ${this.contractAddresses}`)

    this.eventsEmitter = web3events.createEventsEmitter<BlockchainEvent>(contract, options)
    this.initialized = true
  }

  async run (): Promise<void> {
    if (!this.initialized) await this.initialize()

    if (!this.eventsEmitter || !this.newBlockEmitter) {
      throw new Error('Processor was not correctly initialized!')
    }

    // If not set then it is first time running ==> precache
    if (!isServiceInitialized('storage') || this.options?.forcePrecache) {
      await this.precache()
    }

    this.eventsEmitter.on('error', (e: object) => {
      logger.error(`There was unknown error in the blockchain's Events Emitter! ${e}`)
    })

    // Listen on Offer events
    this.eventsEmitter.on(NEW_EVENT_EVENT_NAME, this.processor)

    // Listening for reorgs outside of confirmations range
    this.eventsEmitter.on(REORG_OUT_OF_RANGE_EVENT_NAME, this.appResetCallback)

    // Pinning Garbage Collecting
    this.newBlockEmitter.on(NEW_BLOCK_EVENT_NAME, this.errorHandler(gcHandler({ manager: this.manager }), loggingFactory('gc')))
  }

  async precache (): Promise<void> {
    if (!this.initialized) await this.initialize()

    if (!this.eventsEmitter) {
      throw new Error('Processor was not correctly initialized!')
    }

    const precacheLogger = loggingFactory('processor:blockchain:precache')
    const processor = filterAndTransformBlockchainEvents(
      this.offerId,
      this.eventTransformer,
      this.errorHandler(this.getProcessor<BlockchainEvent, BlockchainEventProcessorOptions>(this.handlers, { eth: this.eth }), logger)
    )

    // Wait to build up the database with latest data
    precacheLogger.verbose('Populating database')
    for await (const batch of this.eventsEmitter.fetch()) {
      for (const event of batch.events) {
        await processor(event)
      }
      precacheLogger.verbose(`Processing: ${Math.round(batch.stepsComplete / batch.totalSteps * 100)}%`)
    }

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
