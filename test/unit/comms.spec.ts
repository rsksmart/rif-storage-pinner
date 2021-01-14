import chai from 'chai'
import dirtyChai from 'dirty-chai'
import chaiAsPromised from 'chai-as-promised'
import sinonChai from 'sinon-chai'
import type Sinon from 'sinon'
import sinon from 'sinon'
import { Sequelize } from 'sequelize-typescript'
import config from 'config'

import * as comms from '@rsksmart/rif-communications-pubsub'

import { sequelizeFactory } from '../../src/sequelize'
import { broadcast, start } from '../../src/communication'
import { AgreementInfoPayload, MessageCodesEnum } from '../../src/definitions'
import Message from '../../src/models/message.model'
import { initStore } from '../../src/store'
import { getObject } from 'sequelize-store'
import PeerId from 'peer-id'
import { Substitute, SubstituteOf } from '@fluffy-spoon/substitute'
import DirectChat from '@rsksmart/rif-communications-pubsub/types/direct'

chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.use(dirtyChai)
const expect = chai.expect

describe('Comms', function () {
  this.timeout(5000)

  let sequelize: Sequelize
  let originalNumberOfSavedMessages: number

  let RoomStub: Sinon.SinonStub
  let broadcastSpy: Sinon.SinonSpy
  let onSpy: Sinon.SinonSpy
  let createLibP2PStub: Sinon.SinonStub
  let DirectChatStub: SubstituteOf<DirectChat>

  before(async (): Promise<void> => {
    sequelize = await sequelizeFactory()
    await sequelize.sync({ force: true })

    // @ts-ignore: Config is not typed
    originalNumberOfSavedMessages = config.comms.countOfMessagesPersistedPerAgreement

    // @ts-ignore: Config is not typed
    config.comms.countOfMessagesPersistedPerAgreement = 3

    RoomStub = sinon.stub(comms, 'Room')
    broadcastSpy = sinon.spy()
    broadcastSpy.returnValues = [Promise.resolve()]
    RoomStub.prototype.broadcast = broadcastSpy
    onSpy = sinon.spy()
    RoomStub.prototype.on = onSpy

    createLibP2PStub = sinon.stub(comms, 'createLibP2P')

    DirectChatStub = Substitute.for<comms.DirectChat>()
    sinon.stub(comms.DirectChat, 'getDirectChat').returns(DirectChatStub)

    const peerId = (await PeerId.create()).toJSON()
    await initStore(sequelize)
    const store = getObject()
    store.peerId = peerId.id
    store.peerPrivKey = peerId.privKey!
    store.peerPubKey = peerId.pubKey!

    await start(undefined, undefined)
  })

  after(() => {
    // @ts-ignore: Config is not typed
    config.comms.countOfMessagesPersistedPerAgreement = originalNumberOfSavedMessages
    sinon.restore()
  })

  describe('Broadcasting', () => {
    let messages: Message[]

    beforeEach(() => {
      broadcastSpy.resetHistory()
    })

    it('should save the broadcasted message', async () => {
      const msg = {
        agreementReference: 'testReference1'
      } as AgreementInfoPayload

      await broadcast(MessageCodesEnum.I_AGREEMENT_NEW, msg)
      await broadcast(MessageCodesEnum.I_AGREEMENT_EXPIRED, msg)

      messages = await Message.findAll({ where: { agreementReference: 'testReference1' } })
      expect(messages).to.have.length(2)
      expect(messages[0].code).to.eql(MessageCodesEnum.I_AGREEMENT_NEW)
      expect(messages[1].code).to.eql(MessageCodesEnum.I_AGREEMENT_EXPIRED)
      expect(broadcastSpy).to.be.calledTwice()
    })

    it('should fail when message does not have agreement reference', async () => {
      const msg = {} as AgreementInfoPayload
      await expect(broadcast(MessageCodesEnum.I_AGREEMENT_NEW, msg)).to.be.rejectedWith('Every broadcasted message has to have Agreement Reference!')
    })

    it('should save at most configured number of broadcasted messages', async () => {
      const msg = {
        agreementReference: 'testReference2'
      } as AgreementInfoPayload

      await broadcast(MessageCodesEnum.I_AGREEMENT_EXPIRED, msg)
      await broadcast(MessageCodesEnum.I_AGREEMENT_EXPIRED, msg)
      await broadcast(MessageCodesEnum.I_AGREEMENT_EXPIRED, msg)
      await broadcast(MessageCodesEnum.I_AGREEMENT_NEW, msg)
      await broadcast(MessageCodesEnum.I_AGREEMENT_NEW, msg)
      await broadcast(MessageCodesEnum.I_AGREEMENT_NEW, msg)

      messages = await Message.findAll({ where: { agreementReference: 'testReference2' } })
      expect(messages).to.have.length(3)
      // The oldest message (the one with I_AGREEMENT_EXPIRED) should have been deleted
      messages.forEach(msg => expect(msg.code).to.eql(MessageCodesEnum.I_AGREEMENT_NEW))
      expect(broadcastSpy).to.have.callCount(6)
    })
  })
})
