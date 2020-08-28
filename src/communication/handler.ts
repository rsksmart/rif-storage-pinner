import { CommsMessage, MessageCodesEnum } from '../definitions'
import type {
  MultiaddrAnnouncementPayload
} from '../definitions'
import { loggingFactory } from '../logger'
import DirectAddressModel from '../models/direct-address.model'

const logger = loggingFactory('comms:handler')

// eslint-disable-next-line require-await
async function handlePeerIdAnnouncement (message: CommsMessage<MultiaddrAnnouncementPayload>): Promise<void> {
  const { payload: { peerId, agreementReference } } = message
  await DirectAddressModel.create({ peerId, agreementReference })
}

// eslint-disable-next-line require-await
async function handleResendLatestMessages (message: CommsMessage<null>): Promise<void> {
  // TODO: Implement this
  throw new Error('Not implemented')
}

export async function handle (message: CommsMessage<any>): Promise<void> {
  switch (message.code) {
    case MessageCodesEnum.I_MULTIADDR_ANNOUNCEMENT:
      await handlePeerIdAnnouncement(message as CommsMessage<MultiaddrAnnouncementPayload>)
      break
    case MessageCodesEnum.I_RESEND_LATEST_MESSAGES:
      await handleResendLatestMessages(message as CommsMessage<null>)
      break
    default:
      logger.error('Unknown message code!', message)
  }
}
