import config from 'config'

import { initCacheTransport, initLibp2pTransport } from './transport'
import { loggingFactory } from '../logger'
import type {
  MessageCodesEnum,
  AgreementInfoPayload,
  HashInfoPayload,
  RetryPayload,
  AgreementSizeExceededPayload, CommsTransport
} from '../definitions'
import Message from '../models/message.model'

const logger = loggingFactory('comms')
const COMMUNICATION_PROTOCOL_VERSION = 1

let transport: CommsTransport

export async function start (offerId?: string, contractAddress?: string): Promise<void> {
  const transportType = config.get('comms.transport')

  switch (transportType) {
    case 'libp2p':
      transport = await initLibp2pTransport(offerId, contractAddress)
      break
    case 'cache':
      transport = await initCacheTransport(offerId, contractAddress)
      break
    default:
      break
  }
}

export function stop (): void {
  transport.stop()
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
  if (!transport) {
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

  await transport.broadcast(msg)
}
