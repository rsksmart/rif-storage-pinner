import chai from 'chai'
import dirtyChai from 'dirty-chai'
import { CID, IpfsClient } from 'ipfs-http-client'

import { TestingApp, asyncIterableToArray, sleep, encodeHash, errorSpy } from '../utils'
import { loggingFactory } from '../../src/logger'

chai.use(dirtyChai)
const logger = loggingFactory('test:pinning')
const expect = chai.expect

interface File {
  fileHash: string
  size: number
  cid: CID
  cidString: string
}

const isPinned = async (ipfs: IpfsClient, cid: CID): Promise<boolean> => {
  try {
    const [file] = await asyncIterableToArray(ipfs.pin.ls(cid))
    return file.cid.toString() === cid.toString()
  } catch (e) {
    if (e.message === `path '${cid}' is not pinned`) return false
    throw e
  }
}

async function createAgreement (app: TestingApp, file: File, billingPeriod: number, money: number, size?: number): Promise<string> {
  const encodedFileHash = encodeHash(file.fileHash)

  const agreementGas = await app.contract
    ?.methods
    .newAgreement(encodedFileHash, app.providerAddress, size ?? file.size, billingPeriod, [])
    .estimateGas({ from: app.consumerAddress, value: money })

  const receipt = await app.contract
    ?.methods
    .newAgreement(encodedFileHash, app.providerAddress, size ?? file.size, billingPeriod, [])
    .send({ from: app.consumerAddress, gas: agreementGas, value: money })
  logger.info('Agreement created')

  await app.advanceBlock()

  return receipt.events.NewAgreement.returnValues.agreementReference
}

const uploadRandomData = async (ipfs: IpfsClient): Promise<File> => {
  const [file] = await asyncIterableToArray(ipfs.add([
    {
      path: `${Math.random().toString(36).substring(7)}.txt`,
      content: `Nice to be on IPFS ${Math.random().toString(36).substring(7)}`
    }
  ]))
  return {
    ...file,
    fileHash: `/ipfs/${file.cid.toString()}`,
    cidString: file.cid.toString()
  }
}

describe('Pinning service', function () {
  this.timeout(100000)
  let app: TestingApp

  before(async () => {
    app = await TestingApp.getApp()
  })
  after(async () => await app.stop())

  it('should pin hash on NewAgreement', async () => {
    const file = await uploadRandomData(app.ipfsConsumer!!)
    // Check if not pinned
    expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

    await createAgreement(app, file, 1, 10000)

    // Wait until we receive Event
    await sleep(1000)

    expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()
  })

  it('should reject if size limit exceed', async () => {
    const file = await uploadRandomData(app.ipfsConsumer!)
    // Check if not pinned
    expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

    await createAgreement(app, file, 1, 10000, file.size - 1)

    // Wait until we receive Event
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

    const agreementReference = await createAgreement(app, file, 1, 500)

    await sleep(1000)

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
  })

  it('should unpin when agreement run out of funds', async () => {
    const file = await uploadRandomData(app.ipfsConsumer!)
    // Check if not pinned
    expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()

    await createAgreement(app, file, 1, 500)
    await sleep(500)

    // Should be pinned
    expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.true()

    // First lets the time fast forward so the Agreement runs out of funds
    await sleep(3000)

    // Create new block to
    await app.advanceBlock()
    await sleep(200)
    await app.advanceBlock()

    await sleep(1500)

    // Should not be be pinned
    expect(await isPinned(app.ipfsProvider!, file.cid)).to.be.false()
  })
})
