import chai from 'chai'
import { CID, IpfsClient } from 'ipfs-http-client'

import { AppSingleton, asyncIterableToArray, sleep, encodeHash, App, errorSpy } from '../utils'
import { loggingFactory } from '../../src/logger'

const logger = loggingFactory('test:pinning')

const expect = chai.expect

const isPinned = async (ipfs: IpfsClient, cid: CID): Promise<boolean> => {
  try {
    const [file] = await asyncIterableToArray(ipfs.pin.ls(cid))
    return file.cid.toString() === cid.toString()
  } catch (e) {
    if (e.message === `path '${cid}' is not pinned`) return false
    throw e
  }
}

const uploadRandomData = async (ipfs: IpfsClient): Promise<{ fileHash: string, size: number, cid: CID, cidString: string }> => {
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

const getAgreementReference = (receipt: { events: { [k: string]: { returnValues: { agreementReference: string } } } }): string => {
  if (!receipt.events['NewAgreement']) throw new Error('Agreement is not created')
  return receipt.events['NewAgreement'].returnValues.agreementReference
}

describe('Pinning service', function () {
  this.timeout(100000)
  let app: App

  before(async () => {
    app = await AppSingleton.getApp()
  })

  it('should pin hash on NewAgreement', async () => {
    const file = await uploadRandomData(app.ipfsConsumer)
    // Check if not pinned
    expect(await isPinned(app.ipfsProvider, file.cid)).to.be.eql(false)

    const encodedFileHash = encodeHash(file.fileHash)

    const agreementGas = await app.contract
      ?.methods
      .newAgreement(encodedFileHash, app.providerAddress, file.size, 1, [])
      .estimateGas({ from: app.consumerAddress, value: 10000 })

    await app.contract
      ?.methods
      .newAgreement(encodedFileHash, app.providerAddress, file.size, 1, [])
      .send({ from: app.consumerAddress, gas: agreementGas, value: 10000 })
    logger.info('Agreement created')

    // Wait until we receive Event
    await sleep(1000)

    expect(await isPinned(app.ipfsProvider, file.cid)).to.be.eql(true)
  })
  it('should reject if size limit exceed', async () => {
    const file = await uploadRandomData(app.ipfsConsumer)
    // Check if not pinned
    expect(await isPinned(app.ipfsProvider, file.cid)).to.be.eql(false)

    const encodedFileHash = encodeHash(file.fileHash)

    const agreementGas = await app.contract
      ?.methods
      .newAgreement(encodedFileHash, app.providerAddress, file.size - 1, 1, [])
      .estimateGas({ from: app.consumerAddress, value: 10000 })

    await app.contract
      ?.methods
      .newAgreement(encodedFileHash, app.providerAddress, file.size - 1, 1, [])
      .send({ from: app.consumerAddress, gas: agreementGas, value: 10000 })
    logger.info('Agreement created')

    // Wait until we receive Event
    await sleep(1000)

    // Should not be pinned
    expect(await isPinned(app.ipfsProvider, file.cid)).to.be.eql(false)
    expect(errorSpy.called).to.be.eql(true)
    const [error] = errorSpy.getCall(-1).args
    expect(error).to.be.instanceOf(Error)
    expect(error.message).to.be.eql('The hash exceeds payed size!')
  })
  it('should unpin when agreement is expired', async () => {
    const file = await uploadRandomData(app.ipfsConsumer)
    // Check if not pinned
    expect(await isPinned(app.ipfsProvider, file.cid)).to.be.eql(false)

    const encodedFileHash = encodeHash(file.fileHash)

    const agreementGas = await app.contract
      ?.methods
      .newAgreement(encodedFileHash, app.providerAddress, file.size, 1, [])
      .estimateGas({ from: app.consumerAddress, value: 500 })

    const receipt = await app.contract
      ?.methods
      .newAgreement(encodedFileHash, app.providerAddress, file.size, 1, [])
      .send({ from: app.consumerAddress, gas: agreementGas, value: 500 })
    logger.info('Agreement created')

    const agreementReference = getAgreementReference(receipt)

    await sleep(1000)

    // Should be pinned
    expect(await isPinned(app.ipfsProvider, file.cid)).to.be.eql(true)

    const payoutGas = await app.contract
      ?.methods
      .payoutFunds([agreementReference])
      .estimateGas({ from: app.providerAddress })

    await app.contract
      ?.methods
      .payoutFunds([agreementReference])
      .send({ from: app.providerAddress, gas: payoutGas })
    logger.debug('Payed out')

    // Wait until we receive Event
    await sleep(1000)

    // Should not be be pinned
    expect(await isPinned(app.ipfsProvider, file.cid)).to.be.eql(false)
  })
})
