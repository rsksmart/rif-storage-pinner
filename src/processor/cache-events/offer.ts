import { getObject } from 'sequelize-store'

import type { Handler, CacheEvent, BaseEventProcessorOptions } from '../../definitions'
import { loggingFactory } from '../../logger'

const logger = loggingFactory('processor:cache:offer')

const handler: Handler<CacheEvent, BaseEventProcessorOptions> = {
  events: ['TotalCapacitySet', 'MessageEmitted'],
  // eslint-disable-next-line require-await
  async process (event: CacheEvent): Promise<void> {
    const store = getObject()

    switch (event.event) {
      case 'TotalCapacitySet':
        break
      case 'MessageEmitted': {
        break
      }
      default: {}
    }
  }
}

export default handler
