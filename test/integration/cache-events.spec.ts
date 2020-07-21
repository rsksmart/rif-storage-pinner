import chai from 'chai'
import dirtyChai from 'dirty-chai'
import config from 'config'
import chaiAsPromised from 'chai-as-promised'
import { getObject } from 'sequelize-store'

import { TestingApp, providerAddress } from '../utils'
import { loggingFactory } from '../../src/logger'
import { Strategy } from '../../src/definitions'
import {
  mockAgreement,
  mockOffer,
  stubResetFunctions, stubOffer, stubAgreement
} from '../fake-cache-service'
import Agreement from '../../src/models/agreement.model'

chai.use(chaiAsPromised)
chai.use(dirtyChai)
const logger = loggingFactory('test:pinning:cache')
const expect = chai.expect

describe('Pinning service', function () {
  this.timeout(100000)

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
    let app: TestingApp
    afterEach(async () => {
      stubResetFunctions(stubOffer)
      stubResetFunctions(stubAgreement)
      await app.stop()
    })
    it('should precache correctly', async () => {
      const offer = mockOffer()
      const agreements = [
        mockAgreement(),
        mockAgreement({ agreementReference: '0x9991', offerId: 'test', billingPeriod: 2 }),
        mockAgreement({ dataReference: '0x999', agreementReference: '0x999', billingPrice: 100 })
      ]
      stubOffer.get.onFirstCall().resolves(offer)
      stubAgreement.find.onFirstCall().resolves(agreements)

      app = await TestingApp.getApp()

      const store = getObject()
      expect(store.peerId).to.be.eql(offer.peerId)
      expect(store.totalCapacity).to.be.eql(offer.totalCapacity)

      const agreementsFromDb = await Agreement.findAll()
      expect(agreementsFromDb.length).to.be.eql(agreements.length)
    })
    it('should throw when offer not found', async () => {
      stubOffer.get.withArgs(providerAddress).resolves()

      await expect(TestingApp.getApp()).to.eventually.be.rejectedWith(Error, 'Offer not exist')
    })
  })

  describe.skip('Events handling', () => {
    let app: TestingApp
    before(async () => {
      app = await TestingApp.getApp()
    })
    after(async () => {
      await app.stop()
    })
  })
})
