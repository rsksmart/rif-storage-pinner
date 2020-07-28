import config from 'config'
import io from 'socket.io-client'
import feathers from '@feathersjs/feathers'
import socketio from '@feathersjs/socketio-client'
import { getObject } from 'sequelize-store'

import offer from './offer'
import agreement from './agreement'
import { EventProcessor } from '../index'
import Agreement from '../../models/agreement.model'
import { loggingFactory } from '../../logger'
import type {
  AppOptions,
  BaseEventProcessorOptions,
  CacheEvent,
  Logger,
  EventsHandler,
  Processor
} from '../../definitions'
import type { ProviderManager } from '../../providers'

const logger: Logger = loggingFactory('processor:cache')

// TODO remove after cache service will be able to filter events for us
function filterCacheEvents (offerId: string, callback: Processor<CacheEvent>): Processor<CacheEvent> {
  return async (event: CacheEvent): Promise<void> => {
    if (event.payload.address === offerId || event.payload.offerId === offerId) await callback(event)
  }
}

// TODO GC using Cache service
export class CacheEventsProcessor extends EventProcessor {
    private readonly handlers = [offer, agreement] as EventsHandler<CacheEvent, BaseEventProcessorOptions>[]
    private readonly processor: Processor<CacheEvent>
    private services: Record<string, feathers.Service<any>> = {}

    constructor (offerId: string, manager: ProviderManager, options?: AppOptions) {
      super(offerId, manager, options)

      this.processorOptions = { ...this.processorOptions, errorLogger: logger }
      this.processor = filterCacheEvents(this.offerId, this.getProcessor<CacheEvent, BaseEventProcessorOptions>(this.handlers))
    }

    // eslint-disable-next-line require-await
    async initialize (): Promise<void> {
      if (this.initialized) throw new Error('Already Initialized')
      logger.info('Connecting websocket to ' + config.get('cache.provider'))

      // Connect to cache service
      const client = feathers()
      const socket = io(config.get('cache.provider'), { transports: ['websocket'] })
      client.configure(socketio(socket))

      this.services = {
        offer: client.service(config.get<string>('cache.offers')),
        agreement: client.service(config.get<string>('cache.agreements'))
      }

      this.initialized = true
    }

    async run (): Promise<void> {
      if (!this.initialized) await this.initialize()

      // Run precache
      await this.precache()

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
      store.peerId = offer?.peerId
      store.totalCapacity = offer?.totalCapacity

      const agreements = await this.services.agreement.find({ query: { offerId: this.offerId }, paginate: false })
      for (const agr of agreements) {
        const agreement = new Agreement(agr)

        // Pin agreements
        if (agreement.isActive && agreement.hasSufficientFunds) {
          await this.manager.pin(agreement.dataReference, agreement.size)
        }
        await Agreement.upsert(agreement.toJSON())
      }
    }

    // eslint-disable-next-line require-await
    async stop (): Promise<void> {
      // Unsubscribe from events
      Object
        .values(this.services)
        .forEach(service => {
          service.removeListener('created', this.processor)
          service.removeListener('updated', this.processor)
        })
    }
}
