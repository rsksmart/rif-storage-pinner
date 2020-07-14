import type { EventData } from 'web3-eth-contract'
import type { Eth } from 'web3-eth'
import type { EventEmitter } from 'events'

import { errorHandler, filterEvents } from '../utils'
import offer from './offer'
import request from './agreement'
import type { Handler } from '../definitions'
import type { ProviderManager } from '../providers'
import { loggingFactory } from '../logger'
import Agreement from '../models/agreement.model'

const precacheLogger = loggingFactory('blockchain:precache')
const HANDLERS: Handler[] = [offer, request]

export default function processor (eth: Eth, manager?: ProviderManager) {
  return async (event: EventData): Promise<void> => {
    const promises = HANDLERS
      .filter(handler => handler.events.includes(event.event))
      .map(handler => handler.process(event, eth, manager))
    await Promise.all(promises)
  }
}

export function getProcessor (offerId: string, eth: Eth, manager?: ProviderManager): (event: EventData) => Promise<void> {
  return filterEvents(offerId, errorHandler(processor(eth, manager), loggingFactory('processor')))
}

export async function precache (eventsEmitter: EventEmitter, manager: ProviderManager, processor: (event: EventData) => Promise<void>): Promise<void> {
  // Wait to build up the database with latest data
  precacheLogger.verbose('Populating database')
  await new Promise<void>((resolve, reject) => {
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
  })

  // Now lets pin every Agreement that has funds
  precacheLogger.verbose('Pinning valid Agreements')
  for (const agreement of await Agreement.findAll()) {
    if (agreement.hasSufficientFunds) {
      await manager.pin(agreement.dataReference, agreement.size)
    }
  }
}
