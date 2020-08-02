import { loggingFactory } from './logger'

const logger = loggingFactory('coms')

export enum MESSAGE_CODE {
  I_GENERAL = 0,
  I_AGREMENT_NEW = 1,
  I_AGREMENT_EXPIRED = 2,
  I_AGREMENT_RENEWED = 3,
  I_HASH_NEW = 4,
  I_HASH_DOWNLOADED = 5,
  E_GENERAL = 100,
  E_HASH_NOT_FOUND = 101,
  E_AGREEMENT_SIZE_LIMIT_EXCEEDED = 102
}

class Communication {
  private static instance: Communication;
  private constructor () {} // eslint-disable-line

  static getInstance () {
    if (!Communication.instance) {
      Communication.instance = new Communication()
    }
    return Communication.instance
  }

  broadcast (code: MESSAGE_CODE, payload?: Record<string, any>) {
    logger.error(`NOT IMPLEMENTED - broadcasting message with code ${code}`, payload)
  }
}

const instance = Communication.getInstance()

export default instance
