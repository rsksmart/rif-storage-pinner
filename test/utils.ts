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
import { reset as resetStore, getObject } from 'sequelize-store'
import { createLibP2P, Message, Room } from '@rsksmart/rif-communications-pubsub'
import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import { initApp } from '../src'
import { AppOptions, CommsMessage, Logger, MessageCodesEnum, Strategy } from '../src/definitions'
import { FakeMarketplaceService } from './fake-marketplace-service'
import { loggingFactory } from '../src/logger'
import { initStore } from '../src/store'
import { sequelizeFactory } from '../src/sequelize'
import { bytesToMegabytes, sleep } from '../src/utils'
import Libp2p from 'libp2p'

export const peerId = 'QmT6rWbq94PtDj9QQmovoivvaRqkZiMJagkJfWQACwCabm'
export const peerPub = 'CAASpgIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDSNAz/NNJXTULmmwoMDGN34u55ZvUYvCmZIBRZxNMdD2aSVbffCroSNyHuMPtSOd6R87oHnD4Zutry3yAN863y1mdzl3Ynm3FOmwRwc/ifdsaa4yS9PwHp/KF1onMNJr/E14sVwvws1FPM7Cir4IXAwX0/uElw26fwTVEXbHboBK8mklPLm8VMuseS78Rf6v/IpvC72RZOBu875QAONh40v1B2T4sJe1h0cl+Oz7jLbi7bnLI8dJt9ybxr1LB8KIWbAMB1L5+c+Q0x2b8pf8/KviEAC+afEEeUXB0nwPU4O6zVsd6rH8TaUXOzHK5ubRF522zy9SkF2Bfve9AWva+xAgMBAAE='
export const peerPriv = 'CAASqAkwggSkAgEAAoIBAQDSNAz/NNJXTULmmwoMDGN34u55ZvUYvCmZIBRZxNMdD2aSVbffCroSNyHuMPtSOd6R87oHnD4Zutry3yAN863y1mdzl3Ynm3FOmwRwc/ifdsaa4yS9PwHp/KF1onMNJr/E14sVwvws1FPM7Cir4IXAwX0/uElw26fwTVEXbHboBK8mklPLm8VMuseS78Rf6v/IpvC72RZOBu875QAONh40v1B2T4sJe1h0cl+Oz7jLbi7bnLI8dJt9ybxr1LB8KIWbAMB1L5+c+Q0x2b8pf8/KviEAC+afEEeUXB0nwPU4O6zVsd6rH8TaUXOzHK5ubRF522zy9SkF2Bfve9AWva+xAgMBAAECggEAEwNySYNVo1/xtTpA5mYYeTelqoWNlfcvLBKixJvxHKfP91yZjStDOXKTNyBnG0DwyPLq2NVhKKKmO2HDXH+2NEkAgowou9xrm1iaRjG3Q3VS8Z+qKxQP8EJRuHpBPedLYVq90fIZLVTnX5nc8+8TKiRWV/Urb3Hu9uWHeD7vYn0f71nkwBE1efRJWgUOBgTgWgO7emjI04omoEHs7NlRYNRoKzGA8xgcZz8+WnfBkuU4J3WN5WNIHbHAPLYr/YTf3y/HfGV/9D0lrSVXM+HOoFFyAjU7Uhq5slUsN4Vb3YEY48oDo+0UTeXz8xgQxGIz708QBXRYaDJ8q9ENgEo6IQKBgQD2lgRDl9OmnZD02ize6Evfx/EoQ1a1ujPk648tVDYAinIdtJ3txygXZsdR55EwmD+Si0/yJSoMim5lNjmYuqHUFOcttwSkMQTEoGSF1+svwBb66fUyhZmok8TuBLQi/xovZqUWFK3tVc2iTjg2fO82gP06y0aLLa7CbHn0iLKQkwKBgQDaOnOhOAP+awch6NoKpXHwB3F8i6wKXc0S2MaSLMZ/V9PkWaHjicsoNOUyi7AFJhshz+FrqsKMJQZxL80oLfgfjmgN5gc1u4ojgL6fhxYSTaw7ALOoYcC8JkvurNQEMalVJa7WfuvJOXLPRqmSAfJEn5rbPqP/w6c5QXbrCx5dKwKBgEVvHKhD2k8yUxz/Sl9CHgtXa6qgu4vUcMRnKBvleIdSdKu0rjvENp/QSxPfFt0OIeiL3ekbWenKGSfaywEcnHDxqd8Ph/kL7IHJgETH9euuNUpWErs1L31ujqdPH8Iy/xaV2qqLDCamYI7xY5bEOz+ntqaVkrmiFXGdxgF7dHyNAoGBAIoxK5nzG+xXoEuj5beKL02dmQsSc56Y6c0+gvh77DMlzeOzsuWhE4phfKZ2eL+58sKFnq0MlGgk5iB08ci424A4MMJkYTpwiTiURaJF6/8pOqCegCZnyKIc6ka5IQWK4T0vQLlJ5Ewn2gFSMP1pyB4Wp/ygfT/wiQuj3gdXoiHDAoGBAKr3eb8hE88jUlGko+bsCeGsEQSYl5IBfRxxWxO7+l1f9zDVM/xPE+YfN7oEmLfl6hiMKsxQX+xDCjnVtUPP5pfgHZR3jzLNd2i1WQELB0CklSrEv2cJ4KIGMCf3X/1o9aojuZCsC7wLefopbMpOw7PRKGmwsXR4ur15EN0oQRWE'
export const consumerIpfsUrl = '/ip4/127.0.0.1/tcp/5002'
export const providerAddress = '0xB22230f21C57f5982c2e7C91162799fABD5733bE'
export const errorSpy = sinon.spy()
export const appResetCallbackSpy = sinon.spy()

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

function generateRandomData (size: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz'.split('')
  const len = chars.length
  const randomData = []

  while (size--) {
    randomData.push(chars[Math.random() * len | 0])
  }

  return randomData.join('')
}

export async function uploadRandomData (ipfs: IpfsClient): Promise<File> {
  const [file] = await asyncIterableToArray(ipfs.add([
    {
      path: `${Math.random().toString(36).substring(7)}.txt`,
      content: `Nice to be on IPFS ${generateRandomData(1000 * 1000 * 2)}`
    }
  ]))
  return {
    ...file,
    size: bytesToMegabytes(file.size).toNumber(),
    fileHash: `/ipfs/${file.cid.toString()}`,
    cidString: file.cid.toString()
  }
}

export class TestingApp {
  static app: TestingApp | undefined

  private logger = loggingFactory('test:test-app')
  private commsLogger = loggingFactory('test:test-app:comms')
  private app: { stop: () => void } | undefined
  public fakeCacheServer: FakeMarketplaceService | undefined
  public contract: Contract | undefined
  public eth: Eth | undefined
  public ipfsConsumer: IpfsClient | undefined
  public ipfsProvider: IpfsClient | undefined
  public sequelize: Sequelize | undefined
  public libp2p: Libp2p | undefined
  public pubsub: Room | undefined
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
    const sequelize = await sequelizeFactory(config.get<string>('db'))
    await sequelize.sync({ force: true })
    await initStore(sequelize)
    const store = getObject()
    store.offerId = this.providerAddress

    // Connection to IPFS consumer/provider nodes
    await this.initIpfs()
    this.logger.info('IPFS clients created')

    // Create PeerId for the Pinner
    store.peerId = peerId
    store.peerPubKey = peerPub
    store.peerPrivKey = peerPriv

    // Create PubSub room to listen on events
    const roomName = `*:${this.contract?.options.address}:${this.providerAddress}`
    this.libp2p = await createLibP2P({
      addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
      config: {
        peerDiscovery: {
          bootstrap: {
            enabled: false
          }
        }
      }
    })

    this.commsLogger.info(`Listening on room ${roomName}`)
    this.pubsub = new Room(this.libp2p, roomName, { pollInterval: 100 })
    this.pubsub.on('peer:joined', (peer) => this.commsLogger.verbose(`${roomName}: peer ${peer} joined`))
    this.pubsub.on('peer:left', (peer) => this.commsLogger.verbose(`${roomName}: peer ${peer} left`))
    this.pubsub.on('message', (msg: Message) => {
      const parsedMsg = msg as unknown as Message<CommsMessage<unknown>>
      this.commsLogger.debug(`Message ${parsedMsg.data.code}:`, msg.data)
    })
  }

  async start (options?: Partial<AppOptions>): Promise<void> {
    // Run Pinning service
    const appOptions = Object.assign({
      errorHandler: errorHandlerStub,
      appResetCallback: appResetCallbackSpy
    }, options, { contractAddress: this.contract?.options.address }) as AppOptions
    this.app = await initApp(this.providerAddress, appOptions)
    this.logger.info('Pinning service started')
  }

  async stop (): Promise<void> {
    if (this.app) {
      await this.app.stop()
    }

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
    this.pubsub?.leave()
    this.pubsub = undefined
    await this.libp2p?.stop()
    this.libp2p = undefined
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

    // TODO: This is not correct! The 0x01 byte will get encoded as well, we need to shift it by the prefix,
    //  but I dont see any easy way how to do it.
    const msg = encodeHash(`0x01${peerId}`)

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

  public awaitForMessage<T> (code: MessageCodesEnum, timeout = 3000): Promise<CommsMessage<T>> {
    return Promise.race<CommsMessage<T>>([
      new Promise<CommsMessage<T>>(resolve => {
        const handler = (msg: Message) => {
          const parsedMsg = msg as unknown as Message<CommsMessage<T>>

          if (parsedMsg.data.code === code) {
            resolve(parsedMsg.data)
            this.pubsub!.off('message', handler)
          }
        }
        this.pubsub!.on('message', handler)
      }),
      (async (): Promise<never> => {
        await sleep(timeout)
        throw new Error(`Waiting for message with code ${code} timed out!`)
      })()
    ])
  }
}
