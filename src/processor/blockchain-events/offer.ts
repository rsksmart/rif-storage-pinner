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

    store.totalCapacity = capacity
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
      const offersPeerId = decodeByteArray([`0x${firstMsg.substring(4)}`, ...restMsg])

      // We don' update PeerId as it is already stored locally, but will Error if they don't match
      if (store.peerId !== offersPeerId) {
        logger.error(`PeerId assigned to Offer is not matching the locally available PeerId! Local: ${store.peerId_id}; Offer: ${offersPeerId}`)
      }
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
