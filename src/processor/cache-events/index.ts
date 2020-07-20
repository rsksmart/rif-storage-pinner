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

export class CacheEventsProcessor extends EventProcessor {
    private readonly handlers = [offer, agreement] as EventsHandler<CacheEvent, BaseEventProcessorOptions>[]
    private readonly logger: Logger = loggingFactory('processor:blockchain')
    private readonly client: feathers.Application
    private readonly processor: Processor<CacheEvent>

    constructor (offerId: string, manager: ProviderManager, options?: AppOptions) {
      super(offerId, manager, options)

      this.client = feathers()

      const processorOptions = {
        processorDeps: { manager: this.manager },
        errorHandler: this.options?.errorHandler,
        errorLogger: this.logger
      }
      // TODO do add filtering for offer
      this.processor = getProcessor<CacheEvent, BaseEventProcessorOptions>(this.handlers, processorOptions)
    }

    async initialize (): Promise<void> {
      if (this.initialized) throw new Error('Already Initialized')

      // TODO add cache to config
      const socket = io('http://localhost:3030')
      this.client.configure(socketio(socket))
      this.logger.info('in connection to cache')

      this.initialized = true
      return await Promise.resolve()
    }

    async run (): Promise<void> {
      if (!this.initialized) await this.initialize()

      this.client.service('/storage/v0/offers').on('created', this.processor)
      this.client.service('/storage/v0/offers').on('updated', this.processor)
      this.client.service('/storage/v0/agreements').on('created', this.processor)
      this.client.service('/storage/v0/agreements').on('updated', this.processor)
    }

    async precache (): Promise<void> {
      if (!this.initialized) await this.initialize()

      const precacheLogger = loggingFactory('blockchain:event-processor:precache')
      // Cache logic here
    }

    async stop (): Promise<void> {
      this.client.service('/storage/v0/offers').removeListener('created')
      this.client.service('/storage/v0/offers').removeListener('updated')
      this.client.service('/storage/v0/agreements').removeListener('created')
      this.client.service('/storage/v0/agreements').removeListener('updated')
      // Unsubscribe from events
      return await Promise.resolve()
    }
}
