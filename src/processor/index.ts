import { AppOptions } from '../definitions'
import { ProviderManager } from '../providers'

interface EventProcessorI {
    offerId: string
    initialized: boolean
}

export abstract class EventProcessor implements EventProcessorI {
    offerId: string
    readonly manager: ProviderManager
    options?: AppOptions
    initialized = false

    protected constructor (offerId: string, manager: ProviderManager, options?: AppOptions) {
      this.offerId = offerId
      this.manager = manager
      this.options = options
    }

    abstract async precache (): Promise<void>
    abstract async initialize (): Promise<void>
    abstract async run (): Promise<void>
    abstract stop (): void
}
