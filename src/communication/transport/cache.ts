import { getObject } from 'sequelize-store'

import { CommsMessage, CommsTransport } from '../../definitions'
import feathers from '@feathersjs/feathers'
import io from 'socket.io-client'
import config from 'config'
import socketio from '@feathersjs/socketio-client'

// eslint-disable-next-line require-await
export async function initTransport (offerId?: string, contractAddress?: string): Promise<CommsTransport> {
  // Connect to cache service
  const client = feathers()
  const socket = io(config.get('marketplace.provider'), { transports: ['websocket'] })
  client.configure(socketio(socket))
  const commsService = client.service(config.get<string>('marketplace.comms'))

  return {
    broadcast: async (message: CommsMessage<any>): Promise<void> => {
      const store = getObject()
      await commsService.create({
        ...message,
        offerId,
        contractAddress,
        publicKey: store.peerPubKey,
        peerId: store.peerId
      })
    },
    stop: () => {
      return true
    }
  }
}
