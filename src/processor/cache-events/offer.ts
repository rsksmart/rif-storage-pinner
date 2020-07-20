import { getObject } from 'sequelize-store'

import type { CacheEvent, BaseEventProcessorOptions, HandlersObject } from '../../definitions'
import { loggingFactory } from '../../logger'
import { buildHandler } from '../../utils'

const logger = loggingFactory('processor:cache:offer')

const handlers: HandlersObject<CacheEvent, BaseEventProcessorOptions> = {
  TotalCapacitySet (event: CacheEvent): Promise<void> {
    const store = getObject()
    const { payload: { totalCapacity: capacity } } = event

    store.totalCapacity = parseInt(capacity)
    logger.info(`Updating capacity ${capacity}`)
    return Promise.resolve()
  },
  MessageEmitted (event: CacheEvent): Promise<void> {
    const store = getObject()

    if (event.payload.peerId) {
      store.peerId = event.payload.peerId
      logger.info(`PeerId ${store.peerId} defined`)
    }
    return Promise.resolve()
  }
}

export default buildHandler<CacheEvent, BaseEventProcessorOptions>(
  handlers,
  ['TotalCapacitySet', 'MessageEmitted']
)
