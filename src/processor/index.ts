import { AppOptions, ErrorHandler, Processor } from '../definitions'
import { ProviderManager } from '../providers'
import { errorHandler } from '../utils'

interface EventProcessorI {
    readonly offerId: string
    initialized: boolean
}

export abstract class EventProcessor implements EventProcessorI {
    readonly offerId: string
    readonly manager: ProviderManager
    readonly options?: AppOptions
    initialized = false

    protected constructor (offerId: string, manager: ProviderManager, options?: AppOptions) {
      this.offerId = offerId
      this.manager = manager
      this.options = options
    }

    get errorHandler (): ErrorHandler {
      return this.options?.errorHandler ?? errorHandler
    }

    abstract filterEvents (offerId: string, callback: Processor<any>): Processor<any>
    abstract async precache (): Promise<void>
    abstract async initialize (): Promise<void>
    abstract async run (): Promise<void>
    async abstract stop (): Promise<void>
}
