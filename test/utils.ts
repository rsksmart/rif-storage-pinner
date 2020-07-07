import config from 'config'
import ganache from 'ganache-core'

import { getObject } from 'sequelize-store'
import { StoreObject } from 'sequelize-store/types/definitions'
import { Sequelize } from 'sequelize-typescript'

import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'
import Eth from 'web3-eth'
import { Contract, EventData } from 'web3-eth-contract'
import { AbiItem, asciiToHex, padRight } from 'web3-utils'

import { sequelizeFactory } from '../src/sequelize'
import { initStore } from '../src/store'
import { ProviderManager } from '../src/providers'
import { IpfsProvider } from '../src/providers/ipfs'
import { getEventsEmitter } from '../src/blockchain/utils'
import { loggingFactory } from '../src/logger'
import process, { precache } from '../src/processor'
import { errorHandler, filterEvents } from '../src/utils'

const logger = loggingFactory('test:pinning')

function getProcessor (offerId: string, eth: Eth, manager?: ProviderManager): (event: EventData) => Promise<void> {
  return filterEvents(offerId, errorHandler(process(eth, manager), loggingFactory('processor')))
}

export interface App {
  sequelize: Sequelize | undefined
  store: StoreObject | undefined
  ipfsManager: ProviderManager | undefined
  contract: Contract | undefined
  eth: Eth | undefined
  consumerAddress: string
  providerAddress: string
}

export class AppSingleton implements App {
  static app: AppSingleton

  public sequelize: Sequelize | undefined = undefined
  public store: StoreObject| undefined = undefined
  public contract: Contract| undefined = undefined
  public eth: Eth | undefined = undefined
  public ipfsManager: ProviderManager | undefined = undefined
  public consumerAddress = ''
  public providerAddress = ''

  static async getApp (): Promise<AppSingleton> {
    if (!AppSingleton.app) {
      AppSingleton.app = new AppSingleton()
      await AppSingleton.app.init()
    }
    return AppSingleton.app
  }

  async init (): Promise<void> {
    // Init sequelize
    await this.initSequelize()

    // Start ganache
    await this.initProvider()

    // Deploy StorageManager for provider
    await this.deployStorageManager()

    // Init IPFS Provider Manager
    await this.initIpfsManager()

    // Setup blockchain watcher
    await this.startBlockchainWatcher()

    // Create an Offer for provider account
    await this.createOffer()
  }

  async initProvider (): Promise<void> {
    // Start ganache and init Web3
    const ganacheProvider = ganache.provider()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.eth = new Eth(ganacheProvider as any)
    const [provider, consumer] = await this.eth.getAccounts()
    this.providerAddress = provider
    this.consumerAddress = consumer
  }

  async initSequelize (): Promise<void> {
    this.sequelize = await sequelizeFactory(config.get<string>('db'))
    await initStore(this.sequelize)
    this.store = getObject()
  }

  async initIpfsManager (): Promise<void> {
    this.ipfsManager = new ProviderManager()
    const ipfs = await IpfsProvider.bootstrap()
    this.ipfsManager.register(ipfs)
  }

  async deployStorageManager (): Promise<void> {
    if (!this.eth || !this.providerAddress) throw new Error('Provider should be initialized and has at least 2 accounts')
    const contract = new this.eth.Contract(storageManagerContractAbi.abi as AbiItem[])
    const deploy = await contract.deploy({ data: storageManagerContractAbi.bytecode })
    this.contract = await deploy.send({ from: this.providerAddress, gas: await deploy.estimateGas() })
  }

  async startBlockchainWatcher (): Promise<void> {
    if (!this.eth || !this.contract || !this.contract.options.address || !this.providerAddress || !this.consumerAddress) {
      throw new Error('Provider should be initialized with at least 2 accounts and StorageManager SC should be deployed')
    }

    if (!this.ipfsManager) throw new Error('IPFS manager should be initialized')

    logger.info(`
  Contract-address: ${this.contract?.options.address}
  Provider: ${this?.providerAddress}
  Consumer: ${this?.consumerAddress}`)

    const eventEmitter = getEventsEmitter(this.eth, storageManagerContractAbi.abi as AbiItem[], { contractAddress: this.contract.options.address })
    eventEmitter.on('error', (e: Error) => {
      logger.error(`There was unknown error in the blockchain's Events Emitter! ${e}`)
    })
    // Make precache
    await precache(eventEmitter, this.ipfsManager, getProcessor(this.providerAddress, this.eth))
    eventEmitter.on('newEvent', getProcessor(this.providerAddress, this.eth, this.ipfsManager))
  }

  async createOffer (): Promise<void> {
    if (!this.contract || !this.providerAddress) {
      throw new Error('Provider should be initialized and has at least 2 accounts and StorageManage contract should be deployed')
    }

    const msg = [padRight(asciiToHex('some string'), 64), padRight(asciiToHex('some other string'), 64)]
    const offerCall = this.contract
      .methods
      .setOffer(1000, [10, 100], [10, 80], msg)
    await offerCall.send({ from: this.providerAddress, gas: await offerCall.estimateGas() })
  }
}
