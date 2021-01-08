import { getObject } from 'sequelize-store'

import { CommsMessage, CommsTransport } from '../../definitions'

export async function initTransport (offerId?: string, contractAddress?: string): Promise<CommsTransport> {
  // TODO create client
  // const client =
  return {
    broadcast: async (message: CommsMessage<any>): Promise<void> => {
      // const store = getObject()
      // await client.create({
      //   ...message,
      //   offerId,
      //   contractAddress
      //   publicKey: store.peerPubKey
      // })
    },
    stop: () => {
      // client.stop()
    }
  }
}
