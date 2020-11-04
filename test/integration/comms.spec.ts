import chai from 'chai'
import dirtyChai from 'dirty-chai'
import config from 'config'

import { createAgreement, TestingApp, uploadRandomData } from '../utils'
import { MessageCodesEnum, Strategy } from '../../src/definitions'

chai.use(dirtyChai)
const expect = chai.expect

describe('Comms', function () {
  this.timeout(50000)
  let app: TestingApp

  before(async () => {
    // @ts-ignore
    config.strategy = Strategy.Blockchain

    app = new TestingApp()
    await app.initAndStart()
  })

  after(async () => {
    if (app) {
      await app.stop()
    }
  })

  it('should rebroadcast messages per request', async () => {
    const file = await uploadRandomData(app.ipfsConsumer!)

    const newAgreementMsgPromise = app.awaitForPubSubMessage(MessageCodesEnum.I_AGREEMENT_NEW)
    const hashStartMsgPromise = app.awaitForPubSubMessage(MessageCodesEnum.I_HASH_START)
    const hashPinnedMsgPromise = app.awaitForPubSubMessage(MessageCodesEnum.I_HASH_PINNED)

    const agreementReference = await createAgreement(app, file, 1, 60)

    const msgs = await Promise.all([hashStartMsgPromise, hashPinnedMsgPromise, newAgreementMsgPromise])

    const expectedReplyPromise = app.awaitForDirectMessage<any[]>()
    await app.sendDirectMessageToPinner({
      code: MessageCodesEnum.I_RESEND_LATEST_MESSAGES,
      payload: {
        agreementReference
      }
    })

    const reply = await expectedReplyPromise
    const rebroadcastMegs = reply.data.map(msg => JSON.parse(msg))

    expect(reply.from).to.eql(app.peerId!.id)
    expect(rebroadcastMegs).to.have.length(3)
    expect(rebroadcastMegs).to.have.deep.members(msgs)
  })
})
