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
import { Strategy } from '../../src/definitions'
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
    size: file.size,
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
  this.timeout(20000)
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
      const offer = mockOffer()
      const agreements: Record<string, any>[] = []
      stubOffer.get.onFirstCall().resolves(offer)
      stubAgreement.find.onFirstCall().resolves(agreements)

      app = await TestingApp.getApp()
    })

    after(async () => {
      await app.stop()
      stubResetFunctions(stubAgreement)
      stubResetFunctions(stubOffer)
    })

    beforeEach(() => errorSpy.resetHistory())

    it('should pin hash on NewAgreement', async () => {
      const file = await uploadRandomData(app.ipfsConsumer!)
      // Check if not pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

      createAgreement(app, file)

      await sleep(1000)

      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()
    })

    it('should reject if size limit exceed', async () => {
      const file = await uploadRandomData(app.ipfsConsumer!)
      // Check if not pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

      createAgreement(app, file, { billingPeriod: 1, size: file.size - 1 })

      await sleep(1000)

      // Should not be pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()
      expect(errorSpy.calledOnce).to.be.eql(true)
      const [error] = errorSpy.lastCall.args
      expect(error).to.be.instanceOf(Error)
      expect(error.message).to.be.eql('The hash exceeds payed size!')
    })

    it('should unpin when agreement is stopped', async () => {
      const file = await uploadRandomData(app.ipfsConsumer!)
      // Check if not pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

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
    })

    it('should unpin when agreement run out of funds', async () => {
      const file = await uploadRandomData(app.ipfsConsumer!)
      // Check if not pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

      await createAgreement(app, file, {
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

      // First lets the time fast forward so the Agreement runs out of funds
      await sleep(3000)

      // Create new block to
      emitBlock(app, { number: 10 })
      await sleep(3000)
      emitBlock(app, { number: 11 })

      await sleep(1500)

      // Should not be be pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()
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
      const ipfs = await initIpfsClient(consumerIpfsUrl)
      file = await uploadRandomData(ipfs)

      await TestingApp.generatePeerId()
      const offer = mockOffer()
      const agreements = [
        mockAgreement(),
        mockAgreement({ agreementReference: '0x9991', offerId: 'test', billingPeriod: 2 }),
        mockAgreement({ availableFunds: 9999999999999, dataReference: file.fileHash, agreementReference: '0x999', billingPrice: 100, size: file.size })
      ]
      stubOffer.get.onFirstCall().resolves(offer)
      stubAgreement.find.resolves(agreements)

      app = await TestingApp.getApp()

      const store = getObject()
      expect(store.peerId).to.be.eql(offer.peerId)
      expect(store.totalCapacity).to.be.eql(offer.totalCapacity)

      const agreementsFromDb = await Agreement.findAll()
      expect(agreementsFromDb.length).to.be.eql(agreements.length)

      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()
    })
  })
})
