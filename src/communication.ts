import PeerId from 'peer-id'
import type Libp2p from 'libp2p'
import { Room, createLibP2P } from '@rsksmart/rif-communications-pubsub'
import { getObject } from 'sequelize-store'
import config from 'config'

import { loggingFactory } from './logger'

const logger = loggingFactory('coms')
const COMMUNICATION_PROTOCOL_VERSION = 1

export enum MessageCodesEnum {
  I_GENERAL = 0,
  I_AGREEMENT_NEW = 1,
  I_AGREEMENT_STOPPED = 2,
  I_AGREEMENT_EXPIRED = 2,
  I_HASH_START = 5,
  I_HASH_PINNED = 6,
  W_GENERAL = 100,
  W_HASH_RETRY = 101,
  E_GENERAL = 1000,
  E_HASH_NOT_FOUND = 1001,
  E_AGREEMENT_SIZE_LIMIT_EXCEEDED = 1002
}

export interface RetryPayload {
  error: string
  retryNumber: number
  totalRetries: number
}

export interface HashInfoPayload {
  hash: string
}

export interface AgreementInfoPayload {
  agreementReference: string
}

export interface AgreementSizeExceededPayload {
  hash: string
  size: number
  expectedSize: number
}

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

  libp2p = await createLibP2P({ peerId })
  room = new Room(libp2p, getRoomTopic())
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

  await room.broadcast(JSON.stringify(msg))
}
