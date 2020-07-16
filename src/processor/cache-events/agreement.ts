import { loggingFactory } from '../../logger'
import type { Handler, Event, CacheEventsProcessorOptions, CacheEvent } from '../../definitions'
import type { ProviderManager } from '../../providers'

const logger = loggingFactory('processor:blockchain:agreement')

const handlers = {
  async NewAgreement (event: CacheEvent, featherClient: any, manager?: ProviderManager): Promise<void> {
    // if (manager) await manager.pin(dataReference, parseInt(data.size))
    //
    // await Agreement.upsert(data) // Agreement might already exist
    // logger.info(`Created new Agreement with ID ${id} for offer ${offerId}`)
  },

  async AgreementStopped (event: CacheEvent, featherClient: any, manager?: ProviderManager): Promise<void> {
    // if (manager) await manager.unpin(agreement.dataReference)
    //
    // agreement.isActive = false
    // await agreement.save()
    //
    // logger.info(`Agreement ${id} was stopped.`)
  },

  async AgreementFundsDeposited (event: CacheEvent): Promise<void> {
    // logger.info(`Agreement ${id} was topped up with ${event.returnValues.amount}.`)
  },

  async AgreementFundsWithdrawn (event: CacheEvent): Promise<void> {
    // logger.info(`${event.returnValues.amount} was withdrawn from funds of Agreement ${id}.`)
  },

  async AgreementFundsPayout (event: CacheEvent, featherClient: any): Promise<void> {
    // logger.info(`${event.returnValues.amount} was payed out from funds of Agreement ${id}.`)
  }
}

function isValidEvent (value: string): value is keyof typeof handlers {
  return value in handlers
}

const handler: Handler = {
  events: ['NewAgreement', 'AgreementFundsDeposited', 'AgreementFundsWithdrawn', 'AgreementFundsPayout', 'AgreementStopped'],
  process (event: Event<CacheEvent>, options: CacheEventsProcessorOptions): Promise<void> {
    const { featherClient, manager } = options

    if (!isValidEvent(event.event)) {
      return Promise.reject(new Error(`Unknown event ${event.event}`))
    }

    return handlers[event.event](event, featherClient, manager)
  }
}
export default handler
