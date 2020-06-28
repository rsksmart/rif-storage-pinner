import { Logger } from './definitions'
import { EventData } from 'web3-eth-contract'
import { hexToAscii } from 'web3-utils'
import Agreement from './models/agreement.model'
import { loggingFactory } from './logger'

const logger = loggingFactory('utils')

export function errorHandler (fn: (...args: any[]) => Promise<void>, logger: Logger): (...args: any[]) => Promise<void> {
  return (...args) => {
    return fn(...args).catch(err => logger.error(err))
  }
}

export function filterEvents (offerId: string, callback: (event: EventData) => Promise<void>) {
  return async (event: EventData): Promise<void> => {
    logger.debug(`Got ${event.event} for provider ${event.returnValues.provider}`)

    if (event.returnValues.provider && event.returnValues.provider === offerId) {
      return callback(event)
    }

    if (event.event.startsWith('Agreement') && await Agreement.findByPk(event.returnValues.agreementReference)) {
      return callback(event)
    }

    return Promise.resolve()
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
