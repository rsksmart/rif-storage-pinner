import {
  AppOptions,
  ErrorHandler,
  EventProcessorOptions,
  EventsHandler,
  GetProcessorOptions,
  Logger,
  Processor,
  StorageEvents
} from '../definitions'
import { loggingFactory } from '../logger'
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
    protected processorOptions: GetProcessorOptions & EventProcessorOptions
    initialized = false

    protected constructor (offerId: string, manager: ProviderManager, options?: AppOptions) {
      this.offerId = offerId
      this.manager = manager
      this.options = options
      this.processorOptions = { manager: this.manager }
    }

    get errorHandler (): ErrorHandler {
      return this.options?.errorHandler ?? errorHandler
    }

    get errorLogger (): Logger {
      return this.processorOptions?.errorLogger ?? loggingFactory('processor')
    }

    getProcessor<T extends StorageEvents, O extends EventProcessorOptions> (handlers: EventsHandler<T, O>[]): Processor<T> {
      const errHandler = this.errorHandler
      const deps = this.processorOptions
      const processor = async (event: T): Promise<void> => {
        const promises = handlers
          .filter(handler => handler.events.includes(event.event))
          .map(handler => handler.process(event, deps as O))
        await Promise.all(promises)
      }
      return errHandler(processor, this.errorLogger)
    }

    abstract async initialize (): Promise<void>
    abstract async run (): Promise<void>
    async abstract stop (): Promise<void>
}
