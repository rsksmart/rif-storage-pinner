import config from 'config'
import sinon from 'sinon'
import ipfsClient, { ClientOptions, IpfsClient } from 'ipfs-http-client'
import Eth from 'web3-eth'
import { Contract } from 'web3-eth-contract'
import { AbiItem, asciiToHex } from 'web3-utils'
import { promisify } from 'util'
import path from 'path'
import { promises as fs } from 'fs'
import type { HttpProvider } from 'web3-core'

import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'
import initApp from '../src'
import { Logger } from '../src/definitions'

const consumerIpfsUrl = '/ip4/127.0.0.1/tcp/5002'

export const errorSpy = sinon.spy()

function errorHandlerStub (fn: (...args: any[]) => Promise<void>, logger: Logger): (...args: any[]) => Promise<void> {
  return (...args) => {
    return fn(...args).catch(err => {
      logger.error(err)
      errorSpy(err)
    })
  }
}

export const sleep = (timeout: number): Promise<void> => new Promise(resolve => setTimeout(resolve, timeout))

export function encodeHash (hash: string): string[] {
  if (hash.length <= 32) {
    return [asciiToHex(hash)]
  }

  return [asciiToHex(hash.slice(0, 32)), ...encodeHash(hash.slice(32))]
}

export async function asyncIterableToArray (asyncIterable: any): Promise<Array<any>> {
  const result = []
  for await (const value of asyncIterable) {
    result.push(value)
  }
  return result
}

async function initIpfsClient (options: ClientOptions | string): Promise<IpfsClient> {
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

export class TestingApp {
  static app: TestingApp

  public contract: Contract | undefined = undefined
  public eth: Eth | undefined = undefined
  public ipfsConsumer: IpfsClient | undefined = undefined
  public ipfsProvider: IpfsClient | undefined = undefined
  public consumerAddress = ''
  public providerAddress = ''

  static async getApp (): Promise<TestingApp> {
    if (!TestingApp.app) {
      TestingApp.app = new TestingApp()
      await TestingApp.app.init()
    }
    return TestingApp.app
  }

  async init (): Promise<void> {
    // Init Provider
    await this.initProvider()

    // Deploy StorageManager for provider
    await this.deployStorageManager()

    // Create an Offer for provider account
    await this.createOffer()

    // Remove current testing db
    await this.purgeDb()

    // Run Pinning job
    await initApp(this.providerAddress, {
      errorHandler: errorHandlerStub,
      contractAddress: this.contract?.options.address
    })

    // Connection to IPFS consumer/provider nodes
    await this.initIpfs()
  }

  private async purgeDb (): Promise<void> {
    try {
      await fs
        .unlink(path.join(process.cwd(), config.get<string>('db')))
    } catch (e) {
      // File does not exist
      if (e.code !== 'ENOENT') {
        throw e
      }
    }
  }

  private async initProvider (): Promise<void> {
    this.eth = new Eth(config.get<string>('blockchain.provider'))
    const [provider, consumer] = await this.eth.getAccounts()
    this.providerAddress = provider
    this.consumerAddress = consumer
  }

  private async initIpfs (): Promise<void> {
    this.ipfsProvider = await initIpfsClient(config.get<string>('ipfs.clientOptions'))
    this.ipfsConsumer = await initIpfsClient(consumerIpfsUrl)
  }

  private async createOffer (): Promise<void> {
    if (!this.contract || !this.providerAddress) {
      throw new Error('Provider should be initialized and has at least 2 accounts and StorageManage contract should be deployed')
    }

    const testPeerId = 'FakePeerId'
    const testPeerIdHex = asciiToHex(testPeerId, 32).replace('0x', '')
    const nodeIdFlag = '01'
    const msg = [`0x${nodeIdFlag}${testPeerIdHex}`]

    const offerCall = this.contract
      .methods
      .setOffer(1000000, [1, 100], [10, 80], msg)
    await offerCall.send({ from: this.providerAddress, gas: await offerCall.estimateGas() })
  }

  private async deployStorageManager (): Promise<void> {
    if (!this.eth || !this.providerAddress) throw new Error('Provider should be initialized and has at least 2 accounts')
    const contract = new this.eth.Contract(storageManagerContractAbi.abi as AbiItem[])
    const deploy = await contract.deploy({ data: storageManagerContractAbi.bytecode })
    this.contract = await deploy.send({ from: this.providerAddress, gas: await deploy.estimateGas() })
  }

  public async advanceBlock (): Promise<void> {
    if (!this.eth || !this.eth.currentProvider) {
      throw new Error('Eth was not initialized!')
    }

    await promisify((this.eth.currentProvider as HttpProvider).send.bind(this.eth.currentProvider))({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [],
      id: new Date().getTime()
    })
  }
}
