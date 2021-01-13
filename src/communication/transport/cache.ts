import config from 'config'
import { getObject } from 'sequelize-store'
import PeerId from 'peer-id'
import io from 'socket.io-client'
import feathers from '@feathersjs/feathers'
import socketio from '@feathersjs/socketio-client'

import { CommsMessage, CommsTransport } from '../../definitions'

// eslint-disable-next-line require-await
export async function initTransport (offerId?: string, contractAddress?: string): Promise<CommsTransport> {
  // Connect to cache service
  const client = feathers()
  const socket = io(config.get('marketplace.provider'), { transports: ['websocket'] })
  client.configure(socketio(socket))
  const commsService = client.service(config.get<string>('marketplace.comms'))
  // Get peerId
  const store = getObject()
  const peerId = await PeerId.createFromPrivKey(store.peerPrivKey as string)

  return {
    broadcast: async (message: CommsMessage<any>): Promise<void> => {
      await commsService.create({
        data: message,
        offerId,
        contractAddress,
        publicKey: store.peerPubKey,
        signature: await peerId.privKey.sign(Buffer.from(JSON.stringify(message)))
      })
    },
    stop: () => {
      return true
    }
  }
}
