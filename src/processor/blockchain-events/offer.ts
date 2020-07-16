import { EventData } from 'web3-eth-contract'
import { getObject } from 'sequelize-store'

import type { Handler, Event } from '../../definitions'
import { loggingFactory } from '../../logger'
import { decodeByteArray } from '../../utils'

const logger = loggingFactory('processor:blockchain:offer')

const handler: Handler = {
  events: ['TotalCapacitySet', 'MessageEmitted'],
  // eslint-disable-next-line require-await
  async process (event: Event<EventData>): Promise<void> {
    const store = getObject()

    switch (event.event) {
      case 'TotalCapacitySet':
        store.totalCapacity = parseInt(event.returnValues.capacity)
        logger.info(`Updating capacity ${event.returnValues.capacity}`)
        break
      case 'MessageEmitted': {
        const msg = event.returnValues.message

        if (!msg || msg.length === 0) {
          break
        }

        const [firstMsg, ...restMsg] = msg
        const flag = firstMsg.substring(2, 4)

        if (flag === '01') { // PeerId definition
          store.peerId = decodeByteArray([`0x${firstMsg.substring(4)}`, ...restMsg])

          logger.info(`PeerId ${store.peerId} defined`)
        } else {
          logger.error(`Unknown message flag ${flag}!`)
        }
        break
      }
      default: {
        logger.error(`Unknown event ${event.event}!`)
      }
    }
  }
}

export default handler
