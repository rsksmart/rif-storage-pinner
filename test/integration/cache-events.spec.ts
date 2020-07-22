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
  isPinned, sleep
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

describe('Cache Strategy', function () {
  this.timeout(100000)
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

  describe('Events handling', () => {
    before(async () => {
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

      const agreement = mockAgreement({
        size: file.size,
        dataReference: file.fileHash,
        availableFunds: 9999999999999,
        agreementReference: '0x999',
        billingPrice: 100
      })
      const agreementService = app.fakeCacheServer?.agreementService
      agreementService.emit('created', { event: 'NewAgreement', payload: agreement })

      // Wait until we receive Event
      await sleep(1000)

      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()
    })
  })
})
