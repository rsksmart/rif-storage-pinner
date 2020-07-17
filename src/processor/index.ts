import { AppOptions } from '../definitions'
import { ProviderManager } from '../providers'

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

    abstract async precache (): Promise<void>
    abstract async initialize (): Promise<void>
    abstract async run (): Promise<void>
    async abstract stop (): Promise<void>
}
