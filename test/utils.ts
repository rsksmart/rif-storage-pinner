import config from 'config'
import sinon from 'sinon'
import ipfsClient, { ClientOptions, IpfsClient } from 'ipfs-http-client'
import Eth from 'web3-eth'
import { Contract } from 'web3-eth-contract'
import { AbiItem, asciiToHex, padRight } from 'web3-utils'

import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'
import initApp from '../src'
import { Logger } from '../src/definitions'

const consumerIpfsUrl = '/ip4/127.0.0.1/tcp/5002'

export const errorSpy = sinon.spy()

const errorHandlerStub = (fn: (...args: any[]) => Promise<void>, logger: Logger): (...args: any[]) => Promise<void> => {
  return (...args) => {
    return fn(...args).catch(err => {
      logger.error(err)
      errorSpy(err)
    })
  }
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

const initIpfsClient = async (options: ClientOptions | string): Promise<IpfsClient> => {
  const ipfs = await ipfsClient(options)

  try {
    await ipfs.version()
  } catch (e) {
    if (e.code === 'ECONNREFUSED') {
      throw new Error(`No running IPFS daemon on ${typeof options === 'object' ? JSON.stringify(options) : options}`)
    }

    throw e
  }
  return ipfs
}

export interface App {
  ipfsConsumer: IpfsClient
  ipfsProvider: IpfsClient
  contract: Contract
  eth: Eth
  consumerAddress: string
  providerAddress: string
}

export class AppSingleton {
  static app: AppSingleton

  public contract: Contract| undefined = undefined
  public eth: Eth | undefined = undefined
  public ipfsConsumer: IpfsClient | undefined = undefined
  public ipfsProvider: IpfsClient | undefined = undefined
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

    // Run Pinning job
    await initApp(this.providerAddress, { errorHandler: errorHandlerStub, contractAddress: this.contract?.options.address })

    // Connection to IPFS consumer/provider nodes
    await this.initIpfs()
  }

  async initProvider (): Promise<void> {
    this.eth = new Eth(config.get<string>('blockchain.provider'))
    const [provider, consumer] = await this.eth.getAccounts()
    this.providerAddress = provider
    this.consumerAddress = consumer
  }

  async initIpfs (): Promise<void> {
    this.ipfsProvider = await initIpfsClient(config.get<string>('ipfs.connection'))
    this.ipfsConsumer = await initIpfsClient(consumerIpfsUrl)
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
