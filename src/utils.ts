import { hexToAscii } from 'web3-utils'
import type { EventEmitter } from 'events'

import type {
  BlockchainEvent,
  BlockchainEventsWithProvider,
  EventProcessorOptions,
  EventsHandler,
  Logger,
  StorageEvents,
  HandlersObject
} from './definitions'

import { loggingFactory } from './logger'

const logger = loggingFactory('utils')

export function errorHandler (fn: (...args: any[]) => Promise<void>, logger: Logger): (...args: any[]) => Promise<void> {
  return (...args) => {
    return fn(...args).catch(err => logger.error(err))
  }
}

export function isEventWithProvider (event: BlockchainEvent): event is BlockchainEventsWithProvider {
  return Boolean((event as BlockchainEventsWithProvider).returnValues.provider)
}

export function isValidEvent (value: string, handlers: object): value is keyof typeof handlers {
  return value in handlers
}

export function buildHandler<T extends StorageEvents, O extends EventProcessorOptions> (handlers: HandlersObject<T, O>, events: string[]): EventsHandler<T, O> {
  return {
    events,
    process: (event: T, options: O): Promise<void> => {
      if (!isValidEvent(event.event, handlers)) {
        return Promise.reject(new Error(`Unknown event ${event.event}`))
      }

      return handlers[event.event](event, options ?? {} as O)
    }
  }
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

/**
 * Duplicate object using JSON method. Functions are stripped.
 * @param obj
 */
export function duplicateObject<T> (obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Create a Promise that is resolved when the specified event is emitted.
 * It is rejected if 'error' event is triggered.
 *
 * Be aware about the different mechanisms of EventEmitter and Promises!
 * Promise can be only ONCE fulfilled/rejected while EventEmitter can emit as many events
 * as it likes! Hence this utility resolves only upon first specified event or error.
 *
 * @param emitted
 * @param event
 */
export function runAndAwaitFirstEvent<T = void> (emitted: EventEmitter, event: string, fn: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    emitted.on(event, resolve)
    emitted.on('error', reject)
    fn()
  })
}

export function sleep<T> (ms: number, ...args: T[]): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(...args), ms))
}
