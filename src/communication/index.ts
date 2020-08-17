import PeerId from 'peer-id'
import type Libp2p from 'libp2p'
import { Room, createLibP2P } from '@rsksmart/rif-communications-pubsub'
import type { Message } from '@rsksmart/rif-communications-pubsub'

import { getObject } from 'sequelize-store'
import config from 'config'

import { loggingFactory } from '../logger'
import type {
  MessageCodesEnum,
  AgreementInfoPayload,
  HashInfoPayload,
  RetryPayload,
  AgreementSizeExceededPayload
} from '../definitions'
import { handle } from './handler'

const logger = loggingFactory('comms')
const COMMUNICATION_PROTOCOL_VERSION = 1

let room: Room
let libp2p: Libp2p

function getRoomTopic (): string {
  const store = getObject()

  return `${config.get<string>('blockchain.networkId')}:${config.get<string>('blockchain.contractAddress')}:${store.offerId}`
}

export async function start (): Promise<void> {
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

  libp2p = await createLibP2P({
    peerId,
    config: {
      peerDiscovery: {
        bootstrap: {
          list: config.get<string[]>('comms.bootnodes')
        }
      }
    }
  })
  const topic = getRoomTopic()
  logger.info(`Joining Room with topic ${topic}`)

  room = new Room(libp2p, topic)
  room.on('peer:joined', (peer) => logger.verbose(`Peer ${peer} joined.`))
  room.on('peer:left', (peer) => logger.verbose(`Peer ${peer} left.`))
  room.on('message', (message: Message): void => {
    try {
      const parsedMessage = JSON.parse(message.data.toString())
      handle(parsedMessage)
    } catch (e) {
      logger.error('We received message that is not a JSON!', message)
    }
  })
}

export async function stop (): Promise<void> {
  if (!libp2p) {
    throw new Error('Communication was not started yet!')
  }

  await libp2p.stop()
}

export async function broadcast (code: MessageCodesEnum.I_AGREEMENT_NEW, payload: AgreementInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.I_AGREEMENT_STOPPED, payload: AgreementInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.I_AGREEMENT_EXPIRED, payload: AgreementInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.I_HASH_PINNED, payload: HashInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.I_HASH_START, payload: HashInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.W_HASH_RETRY, payload: RetryPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.E_HASH_NOT_FOUND, payload: HashInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.E_AGREEMENT_SIZE_LIMIT_EXCEEDED, payload: AgreementSizeExceededPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum, payload?: Record<string, any>): Promise<void>
export async function broadcast (code: MessageCodesEnum, payload?: Record<string, any>): Promise<void> {
  if (!room) {
    throw new Error('Communication was not started yet!')
  }

  const msg = {
    code,
    payload,
    version: COMMUNICATION_PROTOCOL_VERSION,
    timestamp: Date.now()
  }

  // TODO: Persist the sent messages for "rebroadcast"
  await room.broadcast(JSON.stringify(msg))
}
