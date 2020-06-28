import { EventData } from 'web3-eth-contract'
import { loggingFactory } from '../logger'
import { Handler } from '../definitions'
import { decodeByteArray } from '../utils'
import { getObject } from 'sequelize-store'

const logger = loggingFactory('processor:offer')

const handler: Handler = {
  events: ['TotalCapacitySet', 'MessageEmitted'],
  // eslint-disable-next-line require-await
  async process (event: EventData): Promise<void> {
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

        const [firstMsg, ...restMsg] = msg[0].replace('0x', '')
        const flag = firstMsg.substring(0, 2)

        if (flag === '01') { // PeerId definition
          store.peerId = decodeByteArray([firstMsg.substring(2), ...restMsg])
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
