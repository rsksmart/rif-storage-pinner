import config from 'config'
import sinon from 'sinon'
import path from 'path'
import { promises as fs } from 'fs'
import ipfsClient, { CID, ClientOptions, IpfsClient } from 'ipfs-http-client'
import Eth from 'web3-eth'
import { Contract } from 'web3-eth-contract'
import { AbiItem, asciiToHex } from 'web3-utils'
import { promisify } from 'util'
import type { HttpProvider } from 'web3-core'
import { Sequelize } from 'sequelize'
import { reset as resetStore } from 'sequelize-store'

import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import initApp from '../src'
import { AppOptions, Logger, Strategy } from '../src/definitions'
import { FakeMarketplaceService } from './fake-marketplace-service'
import { loggingFactory } from '../src/logger'
import { initStore } from '../src/store'
import { sequelizeFactory } from '../src/sequelize'

export const consumerIpfsUrl = '/ip4/127.0.0.1/tcp/5002'

export const providerAddress = '0xB22230f21C57f5982c2e7C91162799fABD5733bE'
export const errorSpy = sinon.spy()

function errorHandlerStub (fn: (...args: any[]) => Promise<void>, logger: Logger): (...args: any[]) => Promise<void> {
  return (...args) => {
    return fn(...args).catch(err => {
      logger.error(err)
      errorSpy(err)
    })
  }
}

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

export async function initIpfsClient (options: ClientOptions | string): Promise<IpfsClient> {
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

export async function isPinned (ipfs: IpfsClient, cid: CID): Promise<boolean> {
  try {
    const [file] = await asyncIterableToArray(ipfs.pin.ls(cid))
    return file.cid.toString() === cid.toString()
  } catch (e) {
    if (e.message === `path '${cid}' is not pinned`) return false
    throw e
  }
}

export interface File {
  fileHash: string
  size: number
  cid: CID
  cidString: string
}

export async function uploadRandomData (ipfs: IpfsClient): Promise<File> {
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

export class TestingApp {
  static app: TestingApp | undefined

  private logger = loggingFactory('test:test-app')
  private app: { stop: () => void } | undefined
  public fakeCacheServer: FakeMarketplaceService | undefined
  public contract: Contract | undefined
  public eth: Eth | undefined
  public ipfsConsumer: IpfsClient | undefined
  public ipfsProvider: IpfsClient | undefined
  public sequelize: Sequelize | undefined
  public consumerAddress = ''
  public providerAddress = ''

  static async getApp (): Promise<TestingApp> {
    if (!TestingApp.app) {
      TestingApp.app = new TestingApp()
      await TestingApp.app.init()
      await TestingApp.app.start()
    }
    return TestingApp.app
  }

  async init (): Promise<void> {
    const strategy = config.get<string>('strategy')

    switch (strategy) {
      case Strategy.Blockchain:
        // Init Blockchain Provider
        await this.initBlockchainProvider()
        // Deploy StorageManager for provider
        await this.deployStorageManager()
        // Create an Offer for provider account
        await this.createOffer()
        break
      case Strategy.Marketplace:
        // Run fake marketplace service
        await this.initCacheProvider()
        break
      default:
        break
    }
    this.logger.info('Strategy deps initialized')

    // Remove current testing db
    await this.purgeDb()
    this.logger.info('Database removed')

    // Init DB
    this.sequelize = await sequelizeFactory(config.get<string>('db'))
    await initStore(this.sequelize)

    // Connection to IPFS consumer/provider nodes
    await this.initIpfs()
    this.logger.info('IPFS clients created')
  }

  async start (options?: Partial<AppOptions>): Promise<void> {
    // Run Pinning service
    options = Object.assign({
      errorHandler: errorHandlerStub
    }, options, { contractAddress: this.contract?.options.address })
    this.app = await initApp(this.providerAddress, options as AppOptions)
    this.logger.info('Pinning service started')
  }

  async stop (): Promise<void> {
    if (this.app) {
      await this.app.stop()
      this.fakeCacheServer?.stop()
      await this.sequelize?.close()
      resetStore()

      this.sequelize = undefined
      this.app = undefined
      TestingApp.app = undefined
      this.eth = undefined
      this.ipfsConsumer = undefined
      this.contract = undefined
      this.ipfsProvider = undefined
      this.consumerAddress = ''
      this.providerAddress = ''
    }
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

  private async initBlockchainProvider (): Promise<void> {
    this.eth = new Eth(config.get<string>('blockchain.provider'))
    const [provider, consumer] = await this.eth.getAccounts()
    this.providerAddress = provider
    this.consumerAddress = consumer
  }

  async initCacheProvider (): Promise<void> {
    this.fakeCacheServer = new FakeMarketplaceService()
    this.providerAddress = providerAddress
    await this.fakeCacheServer.run()
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
