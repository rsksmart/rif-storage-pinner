import { EventData } from 'web3-eth-contract'
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
        // logger.info(`Updating capacity ${event.returnValues.capacity}`)
        break
      case 'MessageEmitted': {
        break
      }
      default: {
        logger.error(`Unknown event ${event.event}!`)
      }
    }
  }
}

export default handler
