import { asciiToHex } from 'web3-utils'

import { AppSingleton } from '../utils'
import { loggingFactory } from '../../src/logger'

const logger = loggingFactory('test:pinning')

describe('Pinning service', () => {
  let app: AppSingleton

  before(async () => {
    app = await AppSingleton.getApp()
  })

  it('Should pin hash on NewAgreement', async () => {
    const cid = [asciiToHex('/ipfs/QmSomeHash')]
    const agreementGas = await app.contract
      ?.methods
      .newAgreement(cid, app.providerAddress, 100, 10, [])
      .estimateGas({ from: app.consumerAddress, value: 2000 })

    const receipt = await app.contract
      ?.methods
      .newAgreement(cid, app.providerAddress, 100, 10, [])
      .send({ from: app.consumerAddress, gas: agreementGas, value: 2000 })
    logger.info(receipt)
  })
})
