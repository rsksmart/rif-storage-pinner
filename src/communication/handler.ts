import { CommsMessage, MessageCodesEnum } from '../definitions'
import type {
  PeerIdAnnouncementPayload
} from '../definitions'
import { loggingFactory } from '../logger'
import SwarmModel from '../models/swarm.model'

const logger = loggingFactory('comms:handler')

// eslint-disable-next-line require-await
async function handlePeerIdAnnouncement (message: CommsMessage<PeerIdAnnouncementPayload>): Promise<void> {
  const { payload: { multiaddr, agreementReference } } = message
  await SwarmModel.create({ multiaddr, agreementReference })

  throw new Error('Not implemented')
}

// eslint-disable-next-line require-await
async function handleResendLatestMessages (message: CommsMessage<null>): Promise<void> {
  // TODO: Implement this
  throw new Error('Not implemented')
}

export async function handle (message: CommsMessage<any>): Promise<void> {
  switch (message.code) {
    case MessageCodesEnum.I_PEERID_ANNOUNCEMENT:
      await handlePeerIdAnnouncement(message as CommsMessage<PeerIdAnnouncementPayload>)
      break
    case MessageCodesEnum.I_RESEND_LATEST_MESSAGES:
      await handleResendLatestMessages(message as CommsMessage<null>)
      break
    default:
      logger.error('Unknown message code!', message)
  }
}
