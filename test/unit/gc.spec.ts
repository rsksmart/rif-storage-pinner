import { Arg, Substitute } from '@fluffy-spoon/substitute'
import type { BlockHeader } from 'web3-eth'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import chaiAsPromised from 'chai-as-promised'
import sinonChai from 'sinon-chai'
import sinon from 'sinon'
import { Sequelize } from 'sequelize-typescript'
import { Op } from 'sequelize'
import config from 'config'
import type Sinon from 'sinon'

import { sequelizeFactory } from '../../src/sequelize'
import Agreement from '../../src/models/agreement.model'
import { ProviderManager } from '../../src/providers'
import { collectDirectAddresses, collectPinsClosure } from '../../src/gc'
import { MessageCodesEnum } from '../../src/definitions'
import * as channel from '../../src/communication'
import DirectAddressModel from '../../src/models/direct-address.model'
import { sleep } from '../../src/utils'

chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.use(dirtyChai)
const expect = chai.expect

describe('GC', function () {
  let sequelize: Sequelize
  let originalConfirmations: number
  let originalAddress: number
  let channelSpy: Sinon.SinonSpy

  before(async (): Promise<void> => {
    sequelize = await sequelizeFactory()

    // @ts-ignore
    originalConfirmations = config.blockchain.eventsEmitter.confirmations
    // @ts-ignore
    originalAddress = config.directAddress

    // @ts-ignore
    config.blockchain.eventsEmitter.confirmations = 5
    // @ts-ignore
    config.directAddress = { ttl: '1s' } // 1 second

    channelSpy = sinon.stub(channel, 'broadcast')
  })

  after(() => {
    // @ts-ignore
    config.blockchain.eventsEmitter.confirmations = originalConfirmations
    // @ts-ignore
    config.directAddress.ttl = originalAddress

    channelSpy.restore()
  })

  describe('Pinning', () => {
    beforeEach(async () => {
      await sequelize.sync({ force: true })
      channelSpy.resetHistory()
    })
    it('should mark expired Agreement expired', async () => {
      // Already marked
      await Agreement.create({
        agreementReference: '222',
        dataReference: '222',
        consumer: '0x123',
        size: 100,
        billingPeriod: 10,
        billingPrice: 10,
        availableFunds: 1500, // Enough only for one period
        lastPayout: Date.now() - (11 * 1000),
        expiredAtBlockNumber: 9
      })

      // Invalid
      await Agreement.create({
        agreementReference: '321',
        dataReference: '321',
        consumer: '0x123',
        size: 100,
        billingPeriod: 10,
        billingPrice: 10,
        availableFunds: 1500, // Enough only for one period
        lastPayout: Date.now() - (11 * 1000)
      })

      // Valid
      await Agreement.create({
        agreementReference: '123',
        dataReference: '123',
        consumer: '0x123',
        size: 100,
        billingPeriod: 10,
        billingPrice: 10,
        availableFunds: 2500, // Enough for two period
        lastPayout: Date.now() - (11 * 1000)
      })

      const block = Substitute.for<BlockHeader>()
      block.number.returns!(10)

      const manager = Substitute.for<ProviderManager>()
      await collectPinsClosure({ manager })(block)

      const markedAgreements = await Agreement.findAll({
        where: {
          expiredAtBlockNumber: {
            [Op.ne]: null
          }
        }
      })
      expect(markedAgreements.length).to.eql(2)
      expect(markedAgreements[0].dataReference).to.eql('222')
      expect(markedAgreements[1].dataReference).to.eql('321')
      manager.didNotReceive().unpin(Arg.all())
      expect(channelSpy).not.called()
    })

    it('should unmark Agreement when it received funds', async () => {
      // Already marked agreement
      await Agreement.create({
        agreementReference: '222',
        dataReference: '222',
        consumer: '0x123',
        size: 100,
        billingPeriod: 10,
        billingPrice: 10,
        availableFunds: 2500, // Got marked, but then received more funds
        lastPayout: Date.now() - (11 * 1000),
        expiredAtBlockNumber: 9
      })

      const block = Substitute.for<BlockHeader>()
      block.number.returns!(15) // So 5 confirmations is passed

      const manager = Substitute.for<ProviderManager>()
      await collectPinsClosure({ manager })(block)

      const markedAgreements = await Agreement.findAll()
      expect(markedAgreements.length).to.eql(1)
      expect(markedAgreements[0].dataReference).to.eql('222')
      expect(markedAgreements[0].expiredAtBlockNumber).to.be.null()
      expect(markedAgreements[0].isActive).to.be.true()
      manager.didNotReceive().unpin(Arg.all())
      expect(channelSpy).not.called()
    })

    it('should unpin marked Agreements', async () => {
      await Agreement.bulkCreate([
        { // Unpinned
          agreementReference: '111',
          dataReference: '111',
          consumer: '0x123',
          size: 100,
          billingPeriod: 10,
          billingPrice: 10,
          availableFunds: 1500, // Enough only for one period
          lastPayout: Date.now() - (11 * 1000),
          expiredAtBlockNumber: 14
        },
        { // Unpinned
          agreementReference: '222',
          dataReference: '222',
          consumer: '0x123',
          size: 100,
          billingPeriod: 10,
          billingPrice: 10,
          availableFunds: 1500, // Enough only for one period
          lastPayout: Date.now() - (11 * 1000),
          expiredAtBlockNumber: 15
        },
        { // Not unpinned
          agreementReference: '333',
          dataReference: '333',
          consumer: '0x123',
          size: 100,
          billingPeriod: 10,
          billingPrice: 10,
          availableFunds: 1500, // Enough only for one period
          lastPayout: Date.now() - (11 * 1000),
          expiredAtBlockNumber: 16
        }
      ])

      const block = Substitute.for<BlockHeader>()
      block.number.returns!(20)

      const manager = Substitute.for<ProviderManager>()
      await collectPinsClosure({ manager })(block)

      manager.received(1).unpin('222')
      manager.received(1).unpin('111')
      expect(await Agreement.count({ where: { isActive: true } })).to.eql(1)
      expect(channelSpy).has.callCount(2)
      expect(channelSpy).calledWith(MessageCodesEnum.I_AGREEMENT_EXPIRED, { agreementReference: '111' })
      expect(channelSpy).calledWith(MessageCodesEnum.I_AGREEMENT_EXPIRED, { agreementReference: '222' })
    })
  })
  describe('DirectAddressess', () => {
    beforeEach(async () => {
      await sequelize.sync({ force: true })
    })
    it('Should remove expired addressees', async () => {
      await DirectAddressModel.create({ peerId: 'TestPeer', agreementReference: 'testAgreement' })

      await sleep(1100)

      await collectDirectAddresses()()

      expect((await DirectAddressModel.findAll()).length).to.be.eql(0)
    })
    it('Should not remove if not expire', async () => {
      await DirectAddressModel.create({ peerId: 'TestPeer', agreementReference: 'testAgreement' })

      await sleep(500)

      await collectDirectAddresses()()

      expect((await DirectAddressModel.findAll()).length).to.be.eql(1)
    })
  })
})
