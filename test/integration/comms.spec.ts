import chai from 'chai'
import dirtyChai from 'dirty-chai'
import config from 'config'
import PeerId from 'peer-id'

import { createAgreement, File, isPinned, TestingApp, uploadRandomData } from '../utils'
import { CommunicationTransport, MessageCodesEnum, Strategy } from '../../src/definitions'
import {
  mockAgreement,
  mockOffer,
  stubAgreement, stubComms,
  stubOffer,
  stubResetFunctions
} from '../fake-marketplace-service'
import { sleep } from '../../src/utils'

chai.use(dirtyChai)
const expect = chai.expect

function createAgreementMock (app: TestingApp, file: File, agreementObj: Record<string, any> = {}) {
  const agreement = mockAgreement({
    size: Math.ceil(file.size),
    dataReference: file.fileHash,
    availableFunds: 9999999999999,
    agreementReference: `0x${Math.random().toString(36).substring(7)}`,
    billingPrice: 100,
    expiredAtBlockNumber: 99999,
    ...agreementObj
  })

  const agreementService = app.fakeCacheServer?.agreementService
  agreementService.emit('created', { event: 'NewAgreement', payload: agreement })
  return agreement
}

describe('Comms', function () {
  this.timeout(50000)
  let app: TestingApp

  describe('Libp2p comms transport', () => {
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

  describe('Cache comms transport', () => {
    before(async () => {
      // @ts-ignore
      config.comms.transport = CommunicationTransport.Cache
      // @ts-ignore
      config.strategy = Strategy.Marketplace
      config.util.extendDeep(config, { marketplace: { provider: 'http://localhost:3030' } })

      app = new TestingApp()
      await app.init()

      const offer = mockOffer({ peerId: app.peerId?.id })
      stubOffer.get.onFirstCall().resolves(offer)
      stubAgreement.find.onFirstCall().resolves([])
      stubComms.create.resolves(true)

      await app.start({}, false)
    })

    after(async () => {
      if (app) {
        await app.stop()
      }
      stubResetFunctions(stubAgreement)
      stubResetFunctions(stubOffer)

      // @ts-ignore
      config.comms.transport = CommunicationTransport.Libp2p
      // @ts-ignore
      config.strategy = Strategy.Blockchain
    })

    it('should send messages with correct signature', async () => {
      const peerId = await PeerId.createFromJSON(app.peerId as any)
      const file = await uploadRandomData(app.ipfsConsumer!)

      // Check if not pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

      await createAgreementMock(app, file)

      await sleep(3000)

      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()

      const [{ args: [msg1] }, { args: [msg2] }, { args: [msg3] }] = stubComms.create.getCalls()
      const data1 = Buffer.from(JSON.stringify(msg1.data))
      const data2 = Buffer.from(JSON.stringify(msg2.data))
      const data3 = Buffer.from(JSON.stringify(msg3.data))

      expect(await peerId.pubKey.verify(data1, msg1.signature)).to.be.eql(true)
      expect(await peerId.pubKey.verify(data2, msg2.signature)).to.be.eql(true)
      expect(await peerId.pubKey.verify(data3, msg3.signature)).to.be.eql(true)
    })
  })
})
