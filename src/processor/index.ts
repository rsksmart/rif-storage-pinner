import {
  AppOptions,
  EventProcessorOptions,
  EventsHandler,
  Processor,
  StorageEvents
} from '../definitions'

interface EventProcessorI {
    readonly offerId: string
    initialized: boolean
}

export abstract class EventProcessor implements EventProcessorI {
    readonly offerId: string
    readonly options?: AppOptions
    initialized = false

    protected constructor (offerId: string, options?: AppOptions) {
      this.offerId = offerId
      this.options = options
    }

    getProcessor<T extends StorageEvents, O extends EventProcessorOptions> (handlers: EventsHandler<T, O>[], deps: O): Processor<T> {
      const processor = async (event: T): Promise<void> => {
        const promises = handlers
          .filter(handler => handler.events.includes(event.event))
          .map(handler => handler.process(event, deps as O))
        await Promise.all(promises)
      }
      return processor
    }

    abstract initialize (): Promise<void>
    abstract run (): Promise<void>
    abstract stop (): Promise<void>
}
