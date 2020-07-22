import chai from 'chai'
import dirtyChai from 'dirty-chai'
import config from 'config'
import chaiAsPromised from 'chai-as-promised'
import { getObject } from 'sequelize-store'

import {
  TestingApp,
  providerAddress,
  consumerIpfsUrl,
  initIpfsClient,
  uploadRandomData,
  File,
  isPinned,
  sleep,
  errorSpy
} from '../utils'
import { loggingFactory } from '../../src/logger'
import { Strategy } from '../../src/definitions'
import {
  mockAgreement,
  mockOffer,
  stubResetFunctions,
  stubOffer,
  stubAgreement
} from '../fake-cache-service'
import Agreement from '../../src/models/agreement.model'

chai.use(chaiAsPromised)
chai.use(dirtyChai)

const logger = loggingFactory('test:pinning:cache')
const expect = chai.expect

function createAgreement (app: TestingApp, file: File, agreementObj: Record<string, any> = {}) {
  const agreement = mockAgreement({
    size: file.size,
    dataReference: file.fileHash,
    availableFunds: 9999999999999,
    agreementReference: '0x999',
    billingPrice: 100,
    ...agreementObj
  })
  const agreementService = app.fakeCacheServer?.agreementService
  agreementService.emit('created', { event: 'NewAgreement', payload: agreement })
  return agreement
}

describe('Cache Strategy', function () {
  this.timeout(5000)
  let app: TestingApp

  before(() => {
    // @ts-ignore
    config.strategy = Strategy.Cache
    config.util.extendDeep(config, { cache: { provider: 'http://localhost:3030' } })
  })

  after(() => {
    // @ts-ignore
    config.strategy = Strategy.Blockchain
  })

  describe('Events handling', () => {
    before(async () => {
      errorSpy.resetHistory()
      const offer = mockOffer()
      const agreements = [
        mockAgreement(),
        mockAgreement({ agreementReference: '0x9991', offerId: 'test', billingPeriod: 2 }),
        mockAgreement({ availableFunds: 9999999999999, agreementReference: '0x999', billingPrice: 100 })
      ]
      stubOffer.get.onFirstCall().resolves(offer)
      stubAgreement.find.onFirstCall().resolves(agreements)

      app = await TestingApp.getApp()
    })

    after(async () => {
      await app.stop()
    })

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

      const agreementService = app.fakeCacheServer?.agreementService
      agreementService.emit('created', { event: 'AgreementStopped', payload: agreement })

      await sleep(1000)

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

    it('should throw when offer not found', async () => {
      stubOffer.get.withArgs(providerAddress).resolves()

      await expect(TestingApp.getApp()).to.eventually.be.rejectedWith(Error, 'Offer not exist')
    })
  })
})
