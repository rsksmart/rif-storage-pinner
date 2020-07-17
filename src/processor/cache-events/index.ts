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

    private readonly processor: Processor<CacheEvent>

    constructor (offerId: string, manager: ProviderManager, options?: AppOptions) {
      super(offerId, manager, options)

      const socket = io('http://api.my-feathers-server.com')
      const client = feathers()
      client.configure(socketio(socket))

      const processorOptions = {
        processorDeps: { manager: this.manager },
        errorHandler: this.options?.errorHandler,
        errorLogger: this.logger
      }
      // todo add filtering for offer
      this.processor = getProcessor<CacheEvent, BaseEventProcessorOptions>(this.handlers, processorOptions)
    }

    async initialize (): Promise<void> {
      if (this.initialized) throw new Error('Already Initialized')

      this.initialized = true
      return await Promise.resolve()
    }

    async run (): Promise<void> {
      if (!this.initialized) await this.initialize()
      // Subscribe and process events using feather client and processor
    }

    async precache (): Promise<void> {
      if (!this.initialized) await this.initialize()

      const precacheLogger = loggingFactory('blockchain:event-processor:precache')
      // Cache logic here
    }

    async stop (): Promise<void> {
      // Unsubscribe from events
      return await Promise.resolve()
    }
}
