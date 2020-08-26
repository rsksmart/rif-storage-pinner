import chai from 'chai'
import dirtyChai from 'dirty-chai'
import config from 'config'

import { encodeHash, errorSpy, File, isPinned, TestingApp, uploadRandomData } from '../utils'
import { loggingFactory } from '../../src/logger'
import { MessageCodesEnum, Strategy } from '../../src/definitions'
import { sleep } from '../../src/utils'

chai.use(dirtyChai)
const logger = loggingFactory('test:pinning:blockchain')
const expect = chai.expect

async function createAgreement (app: TestingApp, file: File, billingPeriod: number, money: number, size?: number): Promise<string> {
  const encodedFileHash = encodeHash(file.fileHash)

  const agreementSize = Math.ceil(size ?? file.size)
  const agreementGas = await app.contract
    ?.methods
    .newAgreement(encodedFileHash, app.providerAddress, agreementSize, billingPeriod, [])
    .estimateGas({ from: app.consumerAddress, value: money })

  const receipt = await app.contract
    ?.methods
    .newAgreement(encodedFileHash, app.providerAddress, agreementSize, billingPeriod, [])
    .send({ from: app.consumerAddress, gas: agreementGas, value: money })
  logger.info('Agreement created')

  await app.advanceBlock()

  return receipt.events.NewAgreement.returnValues.agreementReference
}

async function depositFunds (app: TestingApp, hash: string, money: number): Promise<void> {
  const dataReference = encodeHash(hash)

  const agreementGas = await app.contract
    ?.methods
    .depositFunds(dataReference, app.providerAddress)
    .estimateGas({ from: app.consumerAddress, value: money })

  await app.contract
    ?.methods
    .depositFunds(dataReference, app.providerAddress)
    .send({ from: app.consumerAddress, gas: agreementGas, value: money })
  logger.info('Funds deposited')

  await app.advanceBlock()
}

describe('Blockchain Strategy', function () {
  this.timeout(50000)
  let app: TestingApp

  before(() => {
    // @ts-ignore
    config.strategy = Strategy.Blockchain
  })

  // TODO: This makes tests fails for the communication
  // describe('Precache', () => {
  //   beforeEach(() => errorSpy.resetHistory())
  //
  //   it('should pin files that have only enough funds', async () => {
  //     try {
  //       app = new TestingApp()
  //       await app.init()
  //
  //       const file = await uploadRandomData(app.ipfsConsumer!)
  //       // Check if not pinned
  //       expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()
  //
  //       // Creates Agreement with funds only for one period
  //       await createAgreement(app, file, 1, Math.ceil(file.size) * 10)
  //       await sleep(1100) // We will wait until they run out
  //
  //       // Start service with precache
  //       await app.start({ forcePrecache: true })
  //
  //       // Wait until we receive Event
  //       await sleep(1000)
  //
  //       // Should NOT be pinned
  //       expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()
  //       expect(errorSpy.called).to.be.false()
  //     } finally {
  //       await app.stop()
  //     }
  //   })
  // })

  describe('Events Handling', () => {
    before(async () => {
      app = await TestingApp.getApp()
    })

    after(async () => await app.stop())

    beforeEach(() => errorSpy.resetHistory())

    it('should pin hash on NewAgreement', async () => {
      const file = await uploadRandomData(app.ipfsConsumer!)
      // Check if not pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

      const newAgreementMsgPromise = app.awaitForMessage(MessageCodesEnum.I_AGREEMENT_NEW)
      const hashStartMsgPromise = app.awaitForMessage(MessageCodesEnum.I_HASH_START)
      const hashPinnedMsgPromise = app.awaitForMessage(MessageCodesEnum.I_HASH_PINNED)

      const agreementReference = await createAgreement(app, file, 1, 10000)

      // Wait until we receive Event
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
      await createAgreement(app, file, 1, 10000, file.size - 1)

      // Wait until we receive Event
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
      const agreementReference = await createAgreement(app, file, 1, 60)

      await sleep(2000)

      // Should be pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()

      const payoutGas = await app.contract
        ?.methods
        .payoutFunds([agreementReference])
        .estimateGas({ from: app.providerAddress })

      await app.contract
        ?.methods
        .payoutFunds([agreementReference])
        .send({ from: app.providerAddress, gas: payoutGas })
      logger.debug('Payed out')

      await app.advanceBlock()

      // Wait until we receive Event
      await sleep(1000)

      // Should not be be pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()
      expect(await agreementStoppedMsgPromise).to.deep.include({ payload: { agreementReference: agreementReference } })
    })

    it('should unpin when agreement run out of funds', async () => {
      const file = await uploadRandomData(app.ipfsConsumer!)
      // Check if not pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

      const newAgreementMsgPromise = app.awaitForMessage(MessageCodesEnum.I_AGREEMENT_NEW)
      const hashStartMsgPromise = app.awaitForMessage(MessageCodesEnum.I_HASH_START)
      const hashPinnedMsgPromise = app.awaitForMessage(MessageCodesEnum.I_HASH_PINNED)

      const agreementReference = await createAgreement(app, file, 1, 60)
      await sleep(500)

      // Should be pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()
      expect(await newAgreementMsgPromise).to.deep.include({ payload: { agreementReference: agreementReference } })
      expect(await hashStartMsgPromise).to.deep.include({ payload: { hash: `/ipfs/${file.cidString}` } })
      expect(await hashPinnedMsgPromise).to.deep.include({ payload: { hash: `/ipfs/${file.cidString}` } })

      // First lets the time fast forward so the Agreement runs out of funds
      await sleep(3000)

      const agreementExpiredMsgPromise = app.awaitForMessage(MessageCodesEnum.I_AGREEMENT_EXPIRED)

      // Create new block to
      await app.advanceBlock()
      await sleep(200)
      await app.advanceBlock()

      await sleep(500)

      // Should not be be pinned
      expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()
      expect(await agreementExpiredMsgPromise).to.deep.include({ payload: { agreementReference: agreementReference } })
    })
  })
})
