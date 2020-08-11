import { loggingFactory } from './logger'

const logger = loggingFactory('coms')

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

class Communication {
  private static instance: Communication

  private constructor () {} // eslint-disable-line

  static getInstance () {
    if (!Communication.instance) {
      Communication.instance = new Communication()
    }
    return Communication.instance
  }

  broadcast (code: MessageCodesEnum.I_AGREEMENT_NEW, payload: AgreementInfoPayload): void
  broadcast (code: MessageCodesEnum.I_AGREEMENT_STOPPED, payload: AgreementInfoPayload): void
  broadcast (code: MessageCodesEnum.I_AGREEMENT_EXPIRED, payload: AgreementInfoPayload): void
  broadcast (code: MessageCodesEnum.I_HASH_PINNED, payload: HashInfoPayload): void
  broadcast (code: MessageCodesEnum.I_HASH_START, payload: HashInfoPayload): void
  broadcast (code: MessageCodesEnum.W_HASH_RETRY, payload: RetryPayload): void
  broadcast (code: MessageCodesEnum.E_HASH_NOT_FOUND, payload: HashInfoPayload): void
  broadcast (code: MessageCodesEnum.E_AGREEMENT_SIZE_LIMIT_EXCEEDED, payload: AgreementSizeExceededPayload): void
  broadcast (code: MessageCodesEnum, payload?: Record<string, any>): void
  broadcast (code: MessageCodesEnum, payload?: Record<string, any>): void {
    logger.error(`NOT IMPLEMENTED - broadcasting message with code ${code}`, payload)
  }
}

export const channel = Communication.getInstance()
