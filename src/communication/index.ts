import PeerId from 'peer-id'
import type Libp2p from 'libp2p'
import { Room, createLibP2P, DirectChat } from '@rsksmart/rif-communications-pubsub'

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
import Message from '../models/message.model'
import { errorHandler } from '../utils'

const logger = loggingFactory('comms')
const COMMUNICATION_PROTOCOL_VERSION = 1

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
  return direct.sendTo(toPeerId, msg)
}

export async function broadcast (code: MessageCodesEnum.I_AGREEMENT_NEW, payload: AgreementInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.I_AGREEMENT_STOPPED, payload: AgreementInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.I_AGREEMENT_EXPIRED, payload: AgreementInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.I_HASH_PINNED, payload: HashInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.I_HASH_START, payload: HashInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.W_HASH_RETRY, payload: RetryPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.E_HASH_NOT_FOUND, payload: HashInfoPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum.E_AGREEMENT_SIZE_LIMIT_EXCEEDED, payload: AgreementSizeExceededPayload): Promise<void>
export async function broadcast (code: MessageCodesEnum, payload: Record<string, any>): Promise<void>
export async function broadcast (code: MessageCodesEnum, payload: Record<string, any>): Promise<void> {
  if (!room) {
    throw new Error('Communication was not started yet!')
  }

  if (!payload.agreementReference) {
    throw new Error('Every broadcasted message has to have Agreement Reference!')
  }

  const msg = {
    code,
    payload,
    version: COMMUNICATION_PROTOCOL_VERSION,
    timestamp: Date.now()
  }

  logger.verbose(`Broadcasting message with code: ${code}`)

  await Message.create({
    code,
    agreementReference: payload.agreementReference,
    message: JSON.stringify(msg)
  })

  // Remove old messages
  const messageLimit = config.get<number>('comms.countOfMessagesPersistedPerAgreement')
  const messagesToDelete = await Message.findAll({
    offset: messageLimit,
    order: [['id', 'DESC']],
    where: { agreementReference: payload.agreementReference }
  })
  await Promise.all(messagesToDelete.map(msg => msg.destroy()))

  await room.broadcast(msg)
}
