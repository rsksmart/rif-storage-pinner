import { getObject } from 'sequelize-store'

import type { Handler, Event, CacheEvent } from '../../definitions'
import { loggingFactory } from '../../logger'

const logger = loggingFactory('processor:cache:offer')

const handler: Handler = {
  events: ['TotalCapacitySet', 'MessageEmitted'],
  // eslint-disable-next-line require-await
  async process (event: Event<CacheEvent>): Promise<void> {
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
