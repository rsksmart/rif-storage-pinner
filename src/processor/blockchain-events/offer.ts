import { getObject } from 'sequelize-store'

import type {
  TotalCapacitySet,
  MessageEmitted
} from '@rsksmart/rif-marketplace-storage/types/web3-v1-contracts/StorageManager'
import { StoreObject } from 'sequelize-store/types/definitions'

import type {
  Handler,
  BlockchainEventProcessorOptions,
  BlockchainOfferEvents
} from '../../definitions'
import { loggingFactory } from '../../logger'
import { decodeByteArray } from '../../utils'

const logger = loggingFactory('processor:blockchain:offer')

const handlers = {
  TotalCapacitySet (event: TotalCapacitySet, options: { store: StoreObject }): void {
    const { store } = options

    store.totalCapacity = parseInt(event.returnValues.capacity)
    logger.info(`Updating capacity ${event.returnValues.capacity}`)
  },

  MessageEmitted (event: MessageEmitted, options: { store: StoreObject }): void {
    const { store } = options
    const msg = event.returnValues.message

    if (!msg || msg.length === 0) {
      return
    }

    const [firstMsg, ...restMsg] = msg
    const flag = firstMsg.substring(2, 4)

    if (flag === '01') { // PeerId definition
      store.peerId = decodeByteArray([`0x${firstMsg.substring(4)}`, ...restMsg])

      logger.info(`PeerId ${options.store.peerId} defined`)
    } else {
      logger.error(`Unknown message flag ${flag}!`)
    }
  }
}

function isValidEvent (value: string): value is keyof typeof handlers {
  return value in handlers
}

const handler: Handler<BlockchainOfferEvents, BlockchainEventProcessorOptions> = {
  events: ['TotalCapacitySet', 'MessageEmitted'],
  // eslint-disable-next-line require-await
  async process (event: BlockchainOfferEvents): Promise<void> {
    const store = getObject()

    if (!isValidEvent(event.event)) {
      return Promise.reject(new Error(`Unknown event ${event.event}`))
    }

    return handlers[event.event](event as MessageEmitted & TotalCapacitySet, { store })
  }
}

export default handler
