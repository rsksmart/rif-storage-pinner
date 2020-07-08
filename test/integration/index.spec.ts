import { asciiToHex, hexToBytes } from 'web3-utils'

import { AppSingleton } from '../utils'
import { loggingFactory } from '../../src/logger'

const logger = loggingFactory('test:pinning')
const sleep = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout))
const encodeHash = (hash: string): string[] => {
  if (hash.length <= 32) {
    return [asciiToHex(hash)]
  }

  return [asciiToHex(hash.slice(0, 32)), ...encodeHash(hash.slice(32))]
}

describe('Pinning service', function () {
  this.timeout(100000)
  let app: AppSingleton
  const cid = encodeHash('/ipfs/QmXis2Lmv4ZcrPWber2QNWuXEfPRsXLDZMFt6fNWybXJ3s')

  before(async () => {
    app = await AppSingleton.getApp()
  })

  it('Should pin hash on NewAgreement', async () => {
    const agreementGas = await app.contract
      ?.methods
      .newAgreement(cid, app.providerAddress, 610, 10, [])
      .estimateGas({ from: app.consumerAddress, value: 10000 })

    const receipt = await app.contract
      ?.methods
      .newAgreement(cid, app.providerAddress, 610, 10, [])
      .send({ from: app.consumerAddress, gas: agreementGas, value: 10000 })
    logger.info('Agreement created')
    await sleep(5000)
  })
})
