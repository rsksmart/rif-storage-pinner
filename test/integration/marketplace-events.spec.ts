import chai from 'chai'
import dirtyChai from 'dirty-chai'
import config from 'config'
import chaiAsPromised from 'chai-as-promised'
import { getObject } from 'sequelize-store'

import {
  TestingApp,
  consumerIpfsUrl,
  initIpfsClient,
  uploadRandomData,
  File,
  isPinned,
  errorSpy
} from '../utils'
import { MessageCodesEnum, Strategy } from '../../src/definitions'
import {
  mockAgreement,
  mockOffer,
  stubResetFunctions,
  stubOffer,
  stubAgreement
} from '../fake-marketplace-service'
import Agreement from '../../src/models/agreement.model'
import { sleep } from '../../src/utils'

chai.use(chaiAsPromised)
chai.use(dirtyChai)

const expect = chai.expect

function createAgreement (app: TestingApp, file: File, agreementObj: Record<string, any> = {}) {
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

function emitBlock (app: TestingApp, block: Record<string, any> = {}) {
  const agreementService = app.fakeCacheServer?.newBlockService
  agreementService.emit('newBlock', block)
  return block
}

describe('Marketplace Strategy', function () {
  this.timeout(5000)
  let app: TestingApp

  before(() => {
    // @ts-ignore
    config.strategy = Strategy.Marketplace
    config.util.extendDeep(config, { marketplace: { provider: 'http://localhost:3030' } })
  })

  after(() => {
    // @ts-ignore
    config.strategy = Strategy.Blockchain
  })

  describe('Events handling', () => {
    before(async () => {
      app = new TestingApp()
      await app.init()

      const offer = mockOffer({ peerId: app.peerId?.id })
      const agreements: Record<string, any>[] = []
      stubOffer.get.onFirstCall().resolves(offer)
      stubAgreement.find.onFirstCall().resolves(agreements)

      await app.start()
    })

    after(async () => {
      if (app) {
        await app.stop()
      }
      stubResetFunctions(stubAgreement)
      stubResetFunctions(stubOffer)
    })

    beforeEach(() => errorSpy.resetHistory())

    it('should pin hash on NewAgreement', async () => {
      const file = await uploadRandomData(app.ipfsConsumer!)
      // Check if not pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

      const newAgreementMsgPromise = app.awaitForMessage(MessageCodesEnum.I_AGREEMENT_NEW)
      const hashStartMsgPromise = app.awaitForMessage(MessageCodesEnum.I_HASH_START)
      const hashPinnedMsgPromise = app.awaitForMessage(MessageCodesEnum.I_HASH_PINNED)

      const agreementReference = createAgreement(app, file).agreementReference

      await sleep(1000)

      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()

      expect(await newAgreementMsgPromise).to.deep.include({ payload: { agreementReference: agreementReference } })
      expect(await hashStartMsgPromise).to.deep.include({ payload: { hash: `/ipfs/${file.cidString}` } })
      expect(await hashPinnedMsgPromise).to.deep.include({ payload: { hash: `/ipfs/${file.cidString}` } })
    })

    it('should reject if size limit exceed', async () => {
      const file = await uploadRandomData(app.ipfsConsumer!)
      // Check if not pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()
      const agreementRejectedMsgPromise = app.awaitForMessage(MessageCodesEnum.E_AGREEMENT_SIZE_LIMIT_EXCEEDED)

      createAgreement(app, file, { billingPeriod: 1, size: Math.ceil(file.size - 1) })

      await sleep(1000)

      // Should not be pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()
      expect(errorSpy.calledOnce).to.be.eql(true)
      const [error] = errorSpy.lastCall.args
      expect(error).to.be.instanceOf(Error)
      expect(error.message).to.be.eql('The hash exceeds payed size!')

      expect((await agreementRejectedMsgPromise).payload).to.include({
        expectedSize: Math.floor(file.size).toString(),
        hash: `/ipfs/${file.cidString}`
      })
    })

    it('should unpin when agreement is stopped', async () => {
      const file = await uploadRandomData(app.ipfsConsumer!)
      // Check if not pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

      const agreementStoppedMsgPromise = app.awaitForMessage(MessageCodesEnum.I_AGREEMENT_STOPPED)
      const agreement = createAgreement(app, file, { billingPeriod: 1, availableFunds: 500 })

      await sleep(1000)

      // Should be pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()

      const agreementFromDb = await Agreement.findByPk(agreement.agreementReference)
      expect(agreementFromDb?.isActive).to.be.true()

      const agreementService = app.fakeCacheServer?.agreementService
      agreementService.emit('created', { event: 'AgreementStopped', payload: agreement })

      await sleep(1000)

      const stopedAgreement = await Agreement.findByPk(agreement.agreementReference)
      expect(stopedAgreement?.isActive).to.be.false()

      // Should not be be pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()
      expect(await agreementStoppedMsgPromise).to.deep.include({ payload: { agreementReference: agreement.agreementReference } })
    })

    it('should unpin when agreement run out of funds', async () => {
      const file = await uploadRandomData(app.ipfsConsumer!)
      // Check if not pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

      const newAgreementMsgPromise = app.awaitForMessage(MessageCodesEnum.I_AGREEMENT_NEW)
      const hashStartMsgPromise = app.awaitForMessage(MessageCodesEnum.I_HASH_START)
      const hashPinnedMsgPromise = app.awaitForMessage(MessageCodesEnum.I_HASH_PINNED)

      const agreement = await createAgreement(app, file, {
        billingPeriod: 10,
        billingPrice: 10,
        size: 100,
        availableFunds: 1500, // Enough only for one period
        lastPayout: Date.now() - (11 * 1000),
        expiredAtBlockNumber: null
      })
      await sleep(500)

      // Should be pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()

      expect(await newAgreementMsgPromise).to.deep.include({ payload: { agreementReference: agreement.agreementReference } })
      expect(await hashStartMsgPromise).to.deep.include({ payload: { hash: `/ipfs/${file.cidString}` } })
      expect(await hashPinnedMsgPromise).to.deep.include({ payload: { hash: `/ipfs/${file.cidString}` } })

      // First lets the time fast forward so the Agreement runs out of funds
      await sleep(2000)
      const agreementExpiredMsgPromise = app.awaitForMessage(MessageCodesEnum.I_AGREEMENT_EXPIRED)

      // Create new block to
      emitBlock(app, { number: 10 })
      await sleep(500)
      emitBlock(app, { number: 11 })

      await sleep(500)

      // Should not be be pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()
      expect(await agreementExpiredMsgPromise).to.deep.include({ payload: { agreementReference: agreement.agreementReference } })
    })
  })

  describe('Precache', () => {
    let file: File

    before(() => {
      stubResetFunctions(stubOffer)
      stubResetFunctions(stubAgreement)
    })

    afterEach(async () => {
      await app.stop()
    })

    it('should precache correctly', async () => {
      app = new TestingApp()
      await app.init()

      const ipfs = await initIpfsClient(consumerIpfsUrl)
      file = await uploadRandomData(ipfs)

      const offer = mockOffer({ peerId: app.peerId?.id })
      const agreements = [
        mockAgreement(),
        mockAgreement({ agreementReference: '0x9991', offerId: 'test', billingPeriod: 2 }),
        mockAgreement({ availableFunds: 9999999999999, dataReference: file.fileHash, agreementReference: '0x999', billingPrice: 100, size: file.size })
      ]
      stubOffer.get.onFirstCall().resolves(offer)
      stubAgreement.find.resolves(agreements)

      await app.start(undefined, false)
      await sleep(100)

      const store = getObject()
      expect(store.peerId).to.be.eql(offer.peerId)
      expect(store.totalCapacity).to.be.eql(offer.totalCapacity)

      const agreementsFromDb = await Agreement.findAll()
      expect(agreementsFromDb.length).to.be.eql(agreements.length)

      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()
    })
  })
})
