import offer from './offer'
import request from './agreement'
import { EventProcessor } from '../index'
import { errorHandler, processor } from '../../utils'
import { AppOptions, Logger } from '../../definitions'
import { loggingFactory } from '../../logger'

import type { ErrorHandler, Handler, Processor } from '../../definitions'
import type { ProviderManager } from '../../providers'

const HANDLERS: Handler[] = [offer, request]

export function getProcessor (offerId: string, featherClient: any | undefined, manager?: ProviderManager, options?: { errorHandler: ErrorHandler | undefined }): Processor {
  // todo add filtering by offerId
  return (options?.errorHandler || errorHandler)(processor(HANDLERS)({ featherClient, manager }), loggingFactory('processor'))
}

export class CacheEventsProcessor extends EventProcessor {
    private logger: Logger = loggingFactory('processor:blockchain')
    private options?: AppOptions

    private featherClient: any
    private processor: Processor
    private readonly manager: ProviderManager

    constructor (offerId: string, manager: ProviderManager, options?: AppOptions) {
      super(offerId)
      this.options = options
      this.manager = manager
      this.offerId = offerId

      // this.featherClient =
      this.processor = getProcessor(this.offerId, this.featherClient, this.manager, { errorHandler: this.options?.errorHandler })
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

    stop (): void {
      // Unsubscribe from events
    }
}
