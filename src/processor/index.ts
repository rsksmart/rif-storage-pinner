import type { EventData } from 'web3-eth-contract'
import type { Eth } from 'web3-eth'
import type { EventEmitter } from 'events'

import offer from './offer'
import request from './agreement'
import type { Handler } from '../definitions'
import { loggingFactory } from '../logger'

const precacheLogger = loggingFactory('blockchain:precache')
const HANDLERS: Handler[] = [offer, request]

export default function processor (eth: Eth) {
  return async (event: EventData): Promise<void> => {
    const promises = HANDLERS
      .filter(handler => handler.events.includes(event.event))
      .map(handler => handler.process(event, eth))
    await Promise.all(promises)
  }
}

export function precache (eventsEmitter: EventEmitter, processor: (event: EventData) => Promise<void>): Promise<void> {
  precacheLogger.verbose('Precaching')
  return new Promise<void>((resolve, reject) => {
    const dataQueue: EventData[] = []
    const dataQueuePusher = (event: EventData): void => { dataQueue.push(event) }

    eventsEmitter.on('initFinished', async () => {
      eventsEmitter.off('newEvent', dataQueuePusher)

      // Needs to be sequentially processed
      try {
        for (const event of dataQueue) {
          await processor(event)
        }
        resolve()
      } catch (e) {
        reject(e)
      }
    })
    eventsEmitter.on('newEvent', dataQueuePusher)
    eventsEmitter.on('error', (e: Error) => {
      precacheLogger.error(`There was unknown error in Events Emitter! ${e}`)
    })
  })
}
