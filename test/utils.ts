import config from 'config'
import initApp from '../src'

import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'
import Eth from 'web3-eth'
import { Contract } from 'web3-eth-contract'
import { Sequelize } from 'sequelize-typescript'
import { AbiItem, asciiToHex, padRight } from 'web3-utils'

import { ProviderManager } from '../src/providers'
import { IpfsProvider } from '../src/providers/ipfs'

const consumerIpfsUrl = '/ip4/127.0.0.1/tcp/5002'

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
    // Init Provider
    await this.initProvider()

    // Deploy StorageManager for provider
    await this.deployStorageManager()

    // Create an Offer for provider account
    await this.createOffer()

    config.util.extendDeep(config, { blockchain: { contractAddress: this.contract?.options.address } })
    const { ipfs, providerManager, sequelize } = await initApp(this.providerAddress)

    this.sequelize = sequelize
    this.ipfsManager = providerManager
    this.ipfsProvider = ipfs
    this.ipfsConsumer = await IpfsProvider.bootstrap(consumerIpfsUrl)
  }

  async initProvider (): Promise<void> {
    const nodeUrl = 'ws://localhost:8545'
    this.eth = new Eth(nodeUrl)
    const [provider, consumer] = await this.eth.getAccounts()
    this.providerAddress = provider
    this.consumerAddress = consumer
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

  async deployStorageManager (): Promise<void> {
    if (!this.eth || !this.providerAddress) throw new Error('Provider should be initialized and has at least 2 accounts')
    const contract = new this.eth.Contract(storageManagerContractAbi.abi as AbiItem[])
    const deploy = await contract.deploy({ data: storageManagerContractAbi.bytecode })
    this.contract = await deploy.send({ from: this.providerAddress, gas: await deploy.estimateGas() })
  }
}
