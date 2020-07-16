import { loggingFactory } from '../../logger'
import type { Handler, Event, CacheEventsProcessorOptions, CacheEvent } from '../../definitions'

const logger = loggingFactory('processor:blockchain:agreement')

const handlers = {
  NewAgreement (event: CacheEvent, options: CacheEventsProcessorOptions): Promise<void> {
    return Promise.resolve()
  },

  AgreementStopped (event: CacheEvent, options: CacheEventsProcessorOptions): Promise<void> {
    return Promise.resolve()
  },

  AgreementFundsDeposited (event: CacheEvent): Promise<void> {
    return Promise.resolve()
  },

  AgreementFundsWithdrawn (event: CacheEvent): Promise<void> {
    return Promise.resolve()
  },

  AgreementFundsPayout (event: CacheEvent, options: CacheEventsProcessorOptions): Promise<void> {
    return Promise.resolve()
  }
}

function isValidEvent (value: string): value is keyof typeof handlers {
  return value in handlers
}

const handler: Handler = {
  events: ['NewAgreement', 'AgreementFundsDeposited', 'AgreementFundsWithdrawn', 'AgreementFundsPayout', 'AgreementStopped'],
  process (event: Event<CacheEvent>, options: CacheEventsProcessorOptions): Promise<void> {
    if (!isValidEvent(event.event)) {
      return Promise.reject(new Error(`Unknown event ${event.event}`))
    }

    return handlers[event.event](event, options)
  }
}
export default handler
