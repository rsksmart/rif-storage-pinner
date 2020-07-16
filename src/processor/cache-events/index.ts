import offer from './offer'
import agreement from './agreement'
import { EventProcessor } from '../index'
import { getProcessor } from '../../utils'
import { AppOptions, Logger } from '../../definitions'
import { loggingFactory } from '../../logger'

import type { Handler, Processor } from '../../definitions'
import type { ProviderManager } from '../../providers'

const HANDLERS: Handler[] = [offer, agreement]

export class CacheEventsProcessor extends EventProcessor {
    private logger: Logger = loggingFactory('processor:blockchain')

    private featherClient: any
    private processor: Processor

    constructor (offerId: string, manager: ProviderManager, options?: AppOptions) {
      super(offerId, manager, options)

      // this.featherClient =
      const processorOptions = { featherClient: this.featherClient, manager: this.manager, errorHandler: this.options?.errorHandler, logger: this.logger }
      // todo add filtering for offer
      this.processor = getProcessor(HANDLERS, processorOptions)
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
