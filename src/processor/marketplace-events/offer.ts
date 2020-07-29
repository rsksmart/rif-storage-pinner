import { getObject } from 'sequelize-store'

import type { MarketplaceEvent, BaseEventProcessorOptions, HandlersObject } from '../../definitions'
import { loggingFactory } from '../../logger'
import { buildHandler } from '../../utils'

const logger = loggingFactory('processor:marketplace:offer')

const handlers: HandlersObject<MarketplaceEvent, BaseEventProcessorOptions> = {
  TotalCapacitySet (event: MarketplaceEvent): Promise<void> {
    const store = getObject()
    const { payload: { totalCapacity: capacity } } = event

    store.totalCapacity = parseInt(capacity)
    logger.info(`Updating capacity ${capacity}`)
    return Promise.resolve()
  },
  MessageEmitted (event: MarketplaceEvent): Promise<void> {
    const store = getObject()

    if (event.payload.peerId) {
      store.peerId = event.payload.peerId
      logger.info(`PeerId ${store.peerId} defined`)
    }
    return Promise.resolve()
  }
}

export default buildHandler<MarketplaceEvent, BaseEventProcessorOptions>(
  handlers,
  ['TotalCapacitySet', 'MessageEmitted']
)
