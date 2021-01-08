import PeerId from 'peer-id'
import type Libp2p from 'libp2p'
import { Room, createLibP2P, DirectChat, JsonSerializable } from '@rsksmart/rif-communications-pubsub'

import { getObject } from 'sequelize-store'
import config from 'config'

import { loggingFactory } from '../../../logger'
import type { CommsMessage, CommsTransport } from '../../../definitions'
import { handle } from './handler'
import { errorHandler } from '../../../utils'

const logger = loggingFactory('comms:libp2p')

let room: Room
let direct: DirectChat
let libp2p: Libp2p

function getRoomTopic (offerId?: string, contractAddress?: string): string {
  const store = getObject()
  const cAddress = contractAddress ?? config.get<string>('blockchain.contractAddress')
  return `${config.get<string>('blockchain.networkId')}:${cAddress.toLowerCase()}:${offerId?.toLowerCase() ?? (store.offerId as string).toLowerCase()}`
}

export async function start (offerId?: string, contractAddress?: string): Promise<void> {
  const store = getObject()

  const peerId = await PeerId.createFromJSON({
    id: store.peerId as string,
    privKey: store.peerPrivKey as string,
    pubKey: store.peerPubKey as string
  })

  // Valid peerId = that has id, privKey and pubKey configured.
  if (!peerId.isValid()) {
    throw new Error('PeerId is not valid!')
  }

  const libp2pConf = {
    ...config.get<object>('comms.libp2p'),
    peerId
  }
  libp2p = await createLibP2P(libp2pConf)

  const topic = getRoomTopic(offerId, contractAddress)
  logger.info(`Joining Room with topic ${topic}`)

  room = new Room(libp2p, topic)
  room.on('peer:joined', (peer) => logger.verbose(`Peer ${peer} joined.`))
  room.on('peer:left', (peer) => logger.verbose(`Peer ${peer} left.`))
  room.on('error', (e) => logger.error(e))

  direct = DirectChat.getDirectChat(libp2p)
  direct.on('error', (e) => logger.error(e))
  direct.on('message', errorHandler(handle, logger))
}

export async function stop (): Promise<void> {
  if (!libp2p) {
    throw new Error('Communication was not started yet!')
  }

  room.leave()
  await libp2p.stop()
}

export function sendTo (toPeerId: string, msg: any): Promise<void> {
  if (!direct) {
    throw new Error('Communication was not started yet!')
  }

  return direct.sendTo(toPeerId, msg)
}

export async function initTransport (offerId?: string, contractAddress?: string): Promise<CommsTransport> {
  await start(offerId, contractAddress)

  return {
    broadcast: async (message: CommsMessage<any>): Promise<void> => {
      if (!room) {
        throw new Error('Communication was not started yet!')
      }

      await room.broadcast(message as JsonSerializable)
    },
    stop
  }
}
