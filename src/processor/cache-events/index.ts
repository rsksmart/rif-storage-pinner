import config from 'config'
import io from 'socket.io-client'
import feathers from '@feathersjs/feathers'
import socketio from '@feathersjs/socketio-client'

import offer from './offer'
import agreement from './agreement'
import { EventProcessor } from '../index'
import { getProcessor } from '../../utils'
import {
  AppOptions,
  BaseEventProcessorOptions,
  CacheEvent,
  Logger
} from '../../definitions'
import { loggingFactory } from '../../logger'

import type { EventsHandler, Processor } from '../../definitions'
import type { ProviderManager } from '../../providers'
import { getObject } from 'sequelize-store'
import Agreement from '../../models/agreement.model'

const logger: Logger = loggingFactory('processor:cache')

// TODO GC using Cache service
export class CacheEventsProcessor extends EventProcessor {
    private readonly handlers = [offer, agreement] as EventsHandler<CacheEvent, BaseEventProcessorOptions>[]
    private readonly processor: Processor<CacheEvent>
    private services: Record<string, feathers.Service<any>> = {}

    constructor (offerId: string, manager: ProviderManager, options?: AppOptions) {
      super(offerId, manager, options)

      const processorOptions = {
        processorDeps: { manager: this.manager },
        errorHandler: this.errorHandler,
        errorLogger: logger
      }
      this.processor = this.filterEvents(this.offerId, getProcessor<CacheEvent, BaseEventProcessorOptions>(this.handlers, processorOptions))
    }

    filterEvents (offerId: string, callback: Processor<CacheEvent>): Processor<CacheEvent> {
      return async (event: CacheEvent) => {
        if (event.payload.address === offerId || event.payload.offerId === offerId) await callback(event)
      }
    }

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
      return await Promise.resolve()
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
      const precacheLogger = loggingFactory('blockchain:event-processor:precache')

      if (!this.initialized) await this.initialize()

      const offer = await this.services.offer.get(this.offerId)

      if (!offer) throw new Error('Offer not exist')
      const store = getObject()
      store.peerId = offer?.peerId
      store.totalCapacity = offer?.totalCapacity

      const agreements = await this.services.agreement.find({ query: { offerId: this.offerId }, paginate: false })
      for (const agr of agreements) {
        const agreement = new Agreement(agr)

        // Pin agreements
        if (agreement.isActive && agreement.hasSufficientFunds) {
          await this.manager.pin(agreement.dataReference, agreement.size).catch(err => precacheLogger.debug(err))
        }
        await Agreement.upsert(agreement.toJSON())
      }
    }

    async stop (): Promise<void> {
      // Unsubscribe from events
      Object
        .values(this.services)
        .forEach(service => {
          service.removeListener('created', this.processor)
          service.removeListener('updated', this.processor)
        })

      return await Promise.resolve()
    }
}
