import config from 'config'
import ganache from 'ganache-core'

import { getObject } from 'sequelize-store'
import { StoreObject } from 'sequelize-store/types/definitions'
import { Sequelize } from 'sequelize-typescript'

import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'
import Eth from 'web3-eth'
import { Contract } from 'web3-eth-contract'
import { AbiItem, asciiToHex, padRight } from 'web3-utils'

import { sequelizeFactory } from '../../src/sequelize'
import { initStore } from '../../src/store'
import { ProviderManager } from '../../src/providers'
import { IpfsProvider } from '../../src/providers/ipfs'
import { getEventsEmitter } from '../../src/blockchain/utils'
import { loggingFactory } from '../../src/logger'
import { getProcessor } from '../../src/cli'
import { precache } from '../../src/processor'

const logger = loggingFactory('test:pinning')

async function init (): Promise<App> {
  const sequelize = await sequelizeFactory(config.get<string>('db'))
  await initStore(sequelize)
  const store = getObject()

  const provider = ganache.provider()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eth = new Eth(provider as any)
  const [providerAddress, consumerAddress] = await eth.getAccounts()

  const contract = new eth.Contract(storageManagerContractAbi.abi as AbiItem[])
  const estimatedGas = await contract.deploy({ data: storageManagerContractAbi.bytecode }).estimateGas()
  const deployedContract = await contract
    .deploy({ data: storageManagerContractAbi.bytecode })
    .send({ from: providerAddress, gas: estimatedGas })

  // Init IPFS Provider Manager
  const manager = new ProviderManager()

  const ipfs = await IpfsProvider.bootstrap()
  manager.register(ipfs)

  // Setup blockchain watcher
  logger.info(`Contract-address: ${deployedContract.options.address}
  Provider: ${providerAddress}
  Consumer: ${consumerAddress}`)
  const eventEmitter = getEventsEmitter(eth, storageManagerContractAbi.abi as AbiItem[], { contractAddress: deployedContract.options.address })
  eventEmitter.on('error', (e: Error) => {
    logger.error(`There was unknown error in the blockchain's Events Emitter! ${e}`)
  })
  // Make precache
  await precache(eventEmitter, manager, getProcessor(providerAddress, eth))
  eventEmitter.on('newEvent', getProcessor(providerAddress, eth, manager))

  // Create new offer for provider
  const msg = [padRight(asciiToHex('some string'), 64), padRight(asciiToHex('some other string'), 64)]
  const offerGas = await deployedContract
    .methods
    .setOffer(1000, [10, 100], [10, 80], msg)
    .estimateGas()

  await deployedContract
    .methods
    .setOffer(1000, [10, 100], [10, 80], msg)
    .send({ from: providerAddress, gas: offerGas })

  return { sequelize, store, eth, contract: deployedContract, consumerAddress, providerAddress }
}

interface App {
  sequelize: Sequelize
  store: StoreObject
  contract: Contract
  eth: Eth
  consumerAddress: string
  providerAddress: string
}

describe('Pinning service', () => {
  let app: App

  before(async () => {
    app = await init()
  })

  it('Should pin hash on NewAgreement', async () => {
    const cid = [asciiToHex('/ipfs/QmSomeHash')]
    const agreementGas = await app.contract
      .methods
      .newAgreement(cid, app.providerAddress, 100, 10, [])
      .estimateGas({ from: app.consumerAddress, value: 2000 })

    const receipt = await app.contract
      .methods
      .newAgreement(cid, app.providerAddress, 100, 10, [])
      .send({ from: app.consumerAddress, gas: agreementGas, value: 2000 })
    logger.info(receipt)
  })
})
