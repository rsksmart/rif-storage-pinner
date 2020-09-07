import { CommsMessage, MessageCodesEnum, ResendMessagesPayload } from '../definitions'
import type {
  MultiaddrAnnouncementPayload
} from '../definitions'
import { loggingFactory } from '../logger'
import DirectAddressModel from '../models/direct-address.model'
import { sendTo } from './index'
import Message from '../models/message.model'
import { MessageDirect } from '@rsksmart/rif-communications-pubsub/types/definitions'

const logger = loggingFactory('comms:handler')

// eslint-disable-next-line require-await
async function handlePeerIdAnnouncement (message: MessageDirect<CommsMessage<MultiaddrAnnouncementPayload>>): Promise<void> {
  const { data: { payload: { peerId, agreementReference } } } = message
  await DirectAddressModel.create({ peerId, agreementReference })
}

// eslint-disable-next-line require-await
async function handleResendLatestMessages (message: MessageDirect<CommsMessage<ResendMessagesPayload>>): Promise<void> {
  const where = {
    where: {
      agreementReference: message.data.payload.agreementReference
    }
  }

  if (message.data.payload.code) {
    // @ts-ignore
    where.where.code = message.data.payload.code
  }

  const messages = await Message.findAll(where)

  await sendTo(message.from, messages.map(msg => msg.message))
}

export async function handle (message: MessageDirect<CommsMessage<any>>): Promise<void> {
  switch (message.data.code) {
    case MessageCodesEnum.I_MULTIADDR_ANNOUNCEMENT:
      await handlePeerIdAnnouncement(message as MessageDirect<CommsMessage<MultiaddrAnnouncementPayload>>)
      break
    case MessageCodesEnum.I_RESEND_LATEST_MESSAGES:
      await handleResendLatestMessages(message as MessageDirect<CommsMessage<ResendMessagesPayload>>)
      break
    default:
      logger.error('Unknown message code!', message)
  }
}
