import chai from "chai"

import { AppSingleton, asyncIterableToArray, sleep, encodeHash, App, errorSpy } from '../utils'
import { loggingFactory } from '../../src/logger'
import { IpfsProvider } from '../../src/providers/ipfs'

const logger = loggingFactory('test:pinning')

const expect = chai.expect

const uploadRandomData = async (ipfsClient: IpfsProvider) => {
  const [file] = await asyncIterableToArray(ipfsClient.add([{
    path: `${Math.random().toString(36).substring(7)}.txt`,
    content: `Nice to be on IPFS ${Math.random().toString(36).substring(7)}`
  }]))
  return {
    ...file,
    fileHash: `/ipfs/${file.cid.toString()}`,
    cid: file.cid.toString()
  }
}

describe('Pinning service', function () {
  this.timeout(100000)
  let app: App

  before(async () => {
    app = await AppSingleton.getApp()
  })
  beforeEach(() => errorSpy.resetHistory())

  it('Should pin hash on NewAgreement', async () => {
    const file = await uploadRandomData(app.ipfsConsumer)
    // Check if not pinned
    expect(await asyncIterableToArray(app.ipfsProvider.ls(file.fileHash)).catch(e => e.message)).to.be.eql(`path '${file.cid}' is not pinned`)

    const encodedFileHash = encodeHash(file.fileHash)

    const agreementGas = await app.contract
      ?.methods
      .newAgreement(encodedFileHash, app.providerAddress, file.size, 10, [])
      .estimateGas({ from: app.consumerAddress, value: 10000 })

    await app.contract
      ?.methods
      .newAgreement(encodedFileHash, app.providerAddress, file.size, 10, [])
      .send({ from: app.consumerAddress, gas: agreementGas, value: 10000 })
    logger.info('Agreement created')

    // Wait until we receive Event
    await sleep(5000)

    const [{ cid }] = await asyncIterableToArray(app.ipfsProvider.ls(file.fileHash))
    expect(cid.toString()).to.be.eql(file.cid)
  })
  it('Should reject if size limit exceed', async () => {
    const file = await uploadRandomData(app.ipfsConsumer)
    // Check if not pinned
    expect(await asyncIterableToArray(app.ipfsProvider.ls(file.fileHash)).catch(e => e.message)).to.be.eql(`path '${file.cid}' is not pinned`)

    const encodedFileHash = encodeHash(file.fileHash)

    const agreementGas = await app.contract
      ?.methods
      .newAgreement(encodedFileHash, app.providerAddress, file.size - 1, 10, [])
      .estimateGas({ from: app.consumerAddress, value: 10000 })

    await app.contract
      ?.methods
      .newAgreement(encodedFileHash, app.providerAddress, file.size - 1, 10, [])
      .send({ from: app.consumerAddress, gas: agreementGas, value: 10000 })
    logger.info('Agreement created')

    // Wait until we receive Event
    await sleep(5000)

    // Should not be pinned
    expect(await asyncIterableToArray(app.ipfsProvider.ls(file.fileHash)).catch(e => e.message)).to.be.eql(`path '${file.cid}' is not pinned`)
    expect(errorSpy.called).to.be.eql(true)
    const [error] = errorSpy.getCall(-1).args
    expect(error).to.be.instanceOf(Error)
    expect(error.message).to.be.eql('The hash exceeds payed size!')
  })
})
