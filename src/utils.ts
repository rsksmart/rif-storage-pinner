import { hexToAscii } from 'web3-utils'

import type {
  BlockchainAgreementEvents,
  BlockchainEvent,
  BlockchainEventsWithProvider,
  ErrorHandler,
  EventProcessorOptions,
  Handler,
  Logger,
  Processor,
  StorageEvents
} from './definitions'
import Agreement from './models/agreement.model'
import { loggingFactory } from './logger'

const logger = loggingFactory('utils')

export function errorHandler (fn: (...args: any[]) => Promise<void>, logger: Logger): (...args: any[]) => Promise<void> {
  return (...args) => {
    return fn(...args).catch(err => logger.error(err))
  }
}

const isEventWithProvider = (event: BlockchainEvent): event is BlockchainEventsWithProvider => {
  return Boolean((event as BlockchainEventsWithProvider).returnValues.provider)
}

export function filterEvents (offerId: string, callback: (event: BlockchainEvent) => Promise<void>) {
  return async (event: BlockchainEvent): Promise<void> => {
    logger.debug(`Got ${event.event} for provider ${(event as BlockchainEventsWithProvider).returnValues.provider}`)

    if (isEventWithProvider(event) && event.returnValues.provider === offerId) {
      return callback(event)
    }

    if (event.event.startsWith('Agreement') && await Agreement.findByPk((event as BlockchainAgreementEvents).returnValues.agreementReference)) {
      return callback(event)
    }

    return Promise.resolve()
  }
}

export const processor = (handlers: Handler<any, any>[], options?: EventProcessorOptions) => async (event: StorageEvents) => {
  const promises = handlers
    .filter(handler => handler.events.includes(event.event))
    .map(handler => handler.process(event, options))
  await Promise.all(promises)
}

export function getProcessor (handlers: Handler<any, any>[], options?: { errorHandler?: ErrorHandler, logger?: Logger, processorDeps: EventProcessorOptions }): Processor<StorageEvents> {
  const errHandler = options?.errorHandler || errorHandler
  return errHandler(processor(handlers, options?.processorDeps), options?.logger || loggingFactory('processor'))
}

/**
 * Utility function for decoding Solidity's byte32 array.
 * @param fileReference
 */
export function decodeByteArray (fileReference: string[]): string {
  return fileReference
    .map(hexToAscii)
    .join('')
    .trim()
    .replace(/\0/g, '') // Remove null-characters
}

export function duplicateObject<T> (obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}
