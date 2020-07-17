import { loggingFactory } from '../../logger'
import type {
  BaseEventProcessorOptions,
  CacheEvent,
  HandlersObject
} from '../../definitions'
import { buildHandler } from '../../utils'

const logger = loggingFactory('processor:blockchain:agreement')

const handlers: HandlersObject<CacheEvent, BaseEventProcessorOptions> = {
  NewAgreement (event: CacheEvent, options: BaseEventProcessorOptions): Promise<void> {
    return Promise.reject(new Error('Not implemented!'))
  },

  AgreementStopped (event: CacheEvent, options: BaseEventProcessorOptions): Promise<void> {
    return Promise.reject(new Error('Not implemented!'))
  },

  AgreementFundsDeposited (event: CacheEvent): Promise<void> {
    return Promise.reject(new Error('Not implemented!'))
  },

  AgreementFundsWithdrawn (event: CacheEvent): Promise<void> {
    return Promise.reject(new Error('Not implemented!'))
  },

  AgreementFundsPayout (event: CacheEvent, options: BaseEventProcessorOptions): Promise<void> {
    return Promise.reject(new Error('Not implemented!'))
  }
}

export default buildHandler<CacheEvent, BaseEventProcessorOptions>(
  handlers,
  ['NewAgreement', 'AgreementFundsDeposited', 'AgreementFundsWithdrawn', 'AgreementFundsPayout', 'AgreementStopped']
)
