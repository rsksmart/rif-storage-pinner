import { getObject } from 'sequelize-store'

import type { MarketplaceEvent, BaseEventProcessorOptions, HandlersObject } from '../../definitions'
import { loggingFactory } from '../../logger'
import { buildHandler } from '../../utils'

const logger = loggingFactory('processor:marketplace:offer')

const handlers: HandlersObject<MarketplaceEvent, BaseEventProcessorOptions> = {
  TotalCapacitySet (event: MarketplaceEvent): Promise<void> {
    const store = getObject()
    const { payload: { totalCapacity: capacity } } = event

    store.totalCapacity = capacity
    logger.info(`Updating capacity ${capacity}`)
    return Promise.resolve()
  },
  MessageEmitted (event: MarketplaceEvent): Promise<void> {
    const store = getObject()

    // We don' update PeerId as it is already stored locally, but will Error if they don't match
    if (event.payload.peerId && store.peerId !== event.payload.peerId) {
      logger.error(`PeerId assigned to Offer is not matching the locally available PeerId! Local: ${store.peerId}; Offer: ${event.payload.peerId}`)
    }
    return Promise.resolve()
  }
}

export default buildHandler<MarketplaceEvent, BaseEventProcessorOptions>(
  handlers,
  ['TotalCapacitySet', 'MessageEmitted']
)
