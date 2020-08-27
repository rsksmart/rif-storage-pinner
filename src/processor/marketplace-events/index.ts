import config from 'config'
import io from 'socket.io-client'
import feathers from '@feathersjs/feathers'
import socketio from '@feathersjs/socketio-client'
import { getObject } from 'sequelize-store'

import offer from './offer'
import agreement from './agreement'
import { EventProcessor } from '../index'
import Agreement from '../../models/agreement.model'
import { collectPinsClosure } from '../../gc'
import { loggingFactory } from '../../logger'
import type {
  AppOptions,
  BaseEventProcessorOptions,
  EventProcessorOptions,
  MarketplaceEvent,
  Logger,
  EventsHandler,
  Processor
} from '../../definitions'
import type { ProviderManager } from '../../providers'
import { errorHandler as originalErrorHandler, getPeerIdByAgreement } from '../../utils'

const logger: Logger = loggingFactory('processor:cache')
const NEW_BLOCK_EVENT = 'newBlock'
export const REORG_OUT_OF_RANGE_EVENT = 'reorgOutOfRange'

// TODO remove after cache service will be able to filter events for us
function filterCacheEvents (offerId: string, callback: Processor<MarketplaceEvent>): Processor<MarketplaceEvent> {
  return async (event: MarketplaceEvent): Promise<void> => {
    if (event.payload.address === offerId || event.payload.offerId === offerId) await callback(event)
  }
}

export class MarketplaceEventsProcessor extends EventProcessor {
    private readonly handlers = [offer, agreement] as EventsHandler<MarketplaceEvent, BaseEventProcessorOptions>[]
    private readonly gcHandler: (...args: any) => Promise<void>
    private readonly processor: Processor<MarketplaceEvent>
    private readonly manager: ProviderManager
    private services: Record<string, feathers.Service<any>> = {}
    private newBlockService: feathers.Service<any> | undefined
    private reorgService: feathers.Service<any> | undefined
    private appResetCallback: () => void

    constructor (offerId: string, manager: ProviderManager, options: AppOptions) {
      super(offerId, options)

      this.appResetCallback = options?.appResetCallback
      const errorHandler = options?.errorHandler ?? originalErrorHandler
      const deps: EventProcessorOptions = {
        manager
      }
      this.processor = filterCacheEvents(this.offerId,
        errorHandler(this.getProcessor<MarketplaceEvent, EventProcessorOptions>(this.handlers, deps), logger)
      )

      this.manager = manager
      this.gcHandler = errorHandler(collectPinsClosure(this.manager), loggingFactory('gc'))
    }

    // eslint-disable-next-line require-await
    async initialize (): Promise<void> {
      if (this.initialized) throw new Error('Already Initialized')
      logger.info('Connecting websocket to ' + config.get('marketplace.provider'))

      // Connect to cache service
      const client = feathers()
      const socket = io(config.get('marketplace.provider'), { transports: ['websocket'] })
      client.configure(socketio(socket))

      this.services = {
        offer: client.service(config.get<string>('marketplace.offers')),
        agreement: client.service(config.get<string>('marketplace.agreements'))
      }
      this.newBlockService = client.service(config.get<string>('marketplace.newBlock'))
      this.reorgService = client.service(config.get<string>('marketplace.reorg'))

      this.initialized = true
      logger.info('Services initialized')
    }

    async run (): Promise<void> {
      if (!this.initialized) await this.initialize()

      // We run precache on every startup to fetch the latest Agreements state
      // The current Agreements get updated thanks to the "upsert" call
      await this.precache()

      // Subscribe for new blocks
      this.newBlockService?.on(NEW_BLOCK_EVENT, this.gcHandler)
      // Subscribe for reorgs
      this.reorgService?.on(REORG_OUT_OF_RANGE_EVENT, (reorgData: { contracts: string[] }) => {
        if (reorgData.contracts.includes('storage')) {
          this.appResetCallback()
        }
      })
      // Subscribe for events
      Object
        .values(this.services)
        .forEach(service => {
          service.on('created', this.processor)
          service.on('updated', this.processor)
        })
      logger.info('Subscribed for events')
    }

    async precache (): Promise<void> {
      if (!this.initialized) await this.initialize()

      const offer = await this.services.offer.get(this.offerId)

      if (!offer) {
        logger.warn(`Offer ${this.offerId} not exist. Pinning will start after offer will be created`)
        return
      }

      const store = getObject()

      if (store.peerId !== offer?.peerId) {
        logger.error(`PeerId assigned to Offer is not matching the locally available PeerId! Local: ${store.peerId}; Offer: ${offer?.peerId}`)
      }
      store.totalCapacity = offer?.totalCapacity

      const agreements = await this.services.agreement.find({ query: { offerId: this.offerId }, paginate: false })
      for (const agr of agreements) {
        const agreement = new Agreement(agr)

        // Pin agreements
        if (agreement.isActive && agreement.hasSufficientFunds) {
          await this.manager.pin(agreement.dataReference, agreement.size, await getPeerIdByAgreement(agreement.agreementReference))
        }
        await Agreement.upsert(agreement.toJSON())
      }
    }

    // eslint-disable-next-line require-await
    async stop (): Promise<void> {
      // Unsubscribe from new blocks event
      this.newBlockService?.removeListener(NEW_BLOCK_EVENT, this.gcHandler)
      // Unsubscribe from reorg event
      this.reorgService?.removeListener(REORG_OUT_OF_RANGE_EVENT, this.appResetCallback)
      // Unsubscribe from events
      Object
        .values(this.services)
        .forEach(service => {
          service.removeListener('created', this.processor)
          service.removeListener('updated', this.processor)
        })
    }
}
