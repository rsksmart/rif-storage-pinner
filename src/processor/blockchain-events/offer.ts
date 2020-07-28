import { getObject } from 'sequelize-store'

import type {
  TotalCapacitySet,
  MessageEmitted
} from '@rsksmart/rif-marketplace-storage/types/web3-v1-contracts/StorageManager'

import type {
  BlockchainEventProcessorOptions,
  BlockchainOfferEvents, HandlersObject
} from '../../definitions'
import { loggingFactory } from '../../logger'
import { buildHandler, decodeByteArray } from '../../utils'

const logger = loggingFactory('processor:blockchain:offer')

const handlers: HandlersObject<BlockchainOfferEvents, BlockchainEventProcessorOptions> = {
  async TotalCapacitySet (event: BlockchainOfferEvents): Promise<void> {
    const store = getObject()
    const { returnValues: { capacity } } = event as TotalCapacitySet

    store.totalCapacity = parseInt(capacity)
    logger.info(`Updating capacity ${capacity}`)
    return await Promise.resolve()
  },

  async MessageEmitted (event: BlockchainOfferEvents): Promise<void> {
    const store = getObject()
    const { returnValues: { message: msg } } = event as MessageEmitted

    if (!msg || msg.length === 0) {
      return Promise.resolve()
    }

    const [firstMsg, ...restMsg] = msg
    const flag = firstMsg.substring(2, 4)

    if (flag === '01') { // PeerId definition
      store.peerId = decodeByteArray([`0x${firstMsg.substring(4)}`, ...restMsg])

      logger.info(`PeerId ${store.peerId} defined`)
    } else {
      logger.error(`Unknown message flag ${flag}!`)
    }
    return await Promise.resolve()
  }
}

export default buildHandler<BlockchainOfferEvents, BlockchainEventProcessorOptions>(
  handlers,
  ['TotalCapacitySet', 'MessageEmitted']
)
