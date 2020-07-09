import config from 'config'
import ganache from 'ganache-core'
import sinon from 'sinon'
// import Ctl from 'ipfsd-ctl'
// import ipfsClient, { IpfsClient } from 'ipfs-http-client'

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
import { filterEvents } from '../src/utils'
import { Logger } from '../src/definitions'

const logger = loggingFactory('test:pinning')

export const errorSpy = sinon.spy()

const errorHandlerStub = (fn: (...args: any[]) => Promise<void>, logger: Logger): (...args: any[]) => Promise<void> => {
  return (...args) => {
    return fn(...args).catch(err => {
      logger.error(err)
      errorSpy(err)
    })
  }
}

export const getProcessor = (offerId: string, eth: Eth, manager?: ProviderManager): (event: EventData) => Promise<void> => {
  return filterEvents(offerId, errorHandlerStub(process(eth, manager), loggingFactory('processor')))
}

export const sleep = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout))

export const encodeHash = (hash: string): string[] => {
  if (hash.length <= 32) {
    return [asciiToHex(hash)]
  }

  return [asciiToHex(hash.slice(0, 32)), ...encodeHash(hash.slice(32))]
}

export const asyncIterableToArray = async (asyncIterable: any): Promise<Array<any>> => {
  const result = []
  for await (const value of asyncIterable) {
    result.push(value)
  }
  return result
}

export interface App {
  sequelize: Sequelize
  store: StoreObject
  ipfsManager: ProviderManager
  ipfsConsumer: IpfsProvider
  ipfsProvider: IpfsProvider
  contract: Contract
  eth: Eth
  consumerAddress: string
  providerAddress: string
}

export class AppSingleton {
  static app: AppSingleton

  public sequelize: Sequelize | undefined = undefined
  public store: StoreObject| undefined = undefined
  public contract: Contract| undefined = undefined
  public eth: Eth | undefined = undefined
  public ipfsManager: ProviderManager | undefined = undefined
  public ipfsConsumer: IpfsProvider | undefined = undefined
  public ipfsProvider: IpfsProvider | undefined = undefined
  public consumerAddress = ''
  public providerAddress = ''

  static async getApp (): Promise<App> {
    if (!AppSingleton.app) {
      AppSingleton.app = new AppSingleton()
      await AppSingleton.app.init()
    }
    return AppSingleton.app as App
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
    this.ipfsProvider = await IpfsProvider.bootstrap(config.get<string>('ipfs.provider'))
    this.ipfsConsumer = await IpfsProvider.bootstrap(config.get<string>('ipfs.consumer'))
    this.ipfsManager.register(this.ipfsProvider)
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
      .setOffer(1000, [1, 100], [10, 80], msg)
    await offerCall.send({ from: this.providerAddress, gas: await offerCall.estimateGas() })
  }
}
