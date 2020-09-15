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
import Libp2p from 'libp2p'
import PeerId from 'peer-id'
import { createLibP2P, Message, Room, DirectChat } from '@rsksmart/rif-communications-pubsub'
import { MessageDirect } from '@rsksmart/rif-communications-pubsub/types/definitions'
import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import { initApp } from '../src'
import { AppOptions, CommsMessage, Logger, MessageCodesEnum, Strategy } from '../src/definitions'
import { FakeMarketplaceService } from './fake-marketplace-service'
import { loggingFactory } from '../src/logger'
import { initStore } from '../src/store'
import { sequelizeFactory } from '../src/sequelize'
import { bytesToMegabytes, sleep } from '../src/utils'

export const consumerIpfsUrl = '/ip4/127.0.0.1/tcp/5002'
export const providerAddress = '0xB22230f21C57f5982c2e7C91162799fABD5733bE'
export const errorSpy = sinon.spy()
export const appResetCallbackSpy = sinon.spy()

interface Listener<T> {
  on: (name: string, fn: (msg: T) => void) => void
  off: (name: string, fn: (msg: T) => void) => void
}

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

/**
 * IN-PLACE prefix array!
 * @param arr
 * @param prefix
 * @param lengthPerElement
 */
export function prefixArray (arr: string[], prefix: string, lengthPerElement = 32): string[] {
  if (prefix.length >= lengthPerElement) {
    throw new Error(`Too long prefix! Max ${lengthPerElement} chars!`)
  }

  const endingLength = lengthPerElement - prefix.length

  let tmp
  let carryOver = prefix
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].length > lengthPerElement) {
      throw new Error(`Element ${i} was longer then expected!`)
    }

    tmp = `${carryOver}${arr[i].slice(0, endingLength)}`
    carryOver = arr[i].slice(endingLength)
    arr[i] = tmp
  }

  if (carryOver) {
    arr.push(carryOver)
  }

  return arr
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
    const [file] = await asyncIterableToArray(ipfs.pin.ls({ paths: cid }))
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
  const file = await ipfs.add(
    {
      path: `${Math.random().toString(36).substring(7)}.txt`,
      content: `Nice to be on IPFS ${generateRandomData(1000 * 1000 * 2)}`
    }
  )

  return {
    ...file,
    size: bytesToMegabytes(file.size).toNumber(),
    fileHash: `/ipfs/${file.cid.toString()}`,
    cidString: file.cid.toString()
  }
}

export class TestingApp {
  private logger = loggingFactory('test:test-app')
  private commsLogger = loggingFactory('test:test-app:comms')
  private app: { stop: () => void } | undefined
  public fakeCacheServer: FakeMarketplaceService | undefined
  public contract: Contract | undefined
  public eth: Eth | undefined
  public ipfsConsumer: IpfsClient | undefined
  public ipfsProvider: IpfsClient | undefined
  public sequelize: Sequelize | undefined
  public peerId: PeerId.JSONPeerId | undefined
  public libp2p: Libp2p | undefined
  public pubsub: Room | undefined
  public direct: DirectChat | undefined
  public consumerAddress = ''
  public providerAddress = ''

  async initAndStart (options?: Partial<AppOptions>, awaitComms = true): Promise<void> {
    await this.init()
    await this.start(options, awaitComms)
  }

  async init (): Promise<void> {
    const strategy = config.get<string>('strategy')

    this.peerId = (await PeerId.create()).toJSON()

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
    store.peerId = this.peerId.id
    store.peerPubKey = this.peerId.pubKey!
    store.peerPrivKey = this.peerId.privKey

    // Create PubSub room to listen on events
    const roomName = `*:${this.providerAddress}`
    this.libp2p = await createLibP2P({
      addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
      peerId: await PeerId.create(),
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
      this.commsLogger.debug(`Pubsub message ${parsedMsg.data.code}:`, msg.data)
    })

    this.commsLogger.info('Listening on direct chat!')
    this.direct = DirectChat.getDirectChat(this.libp2p)
    this.direct.on('message', (msg: MessageDirect) => {
      this.commsLogger.debug('Direct message:', msg)
    })
  }

  async start (options?: Partial<AppOptions>, awaitComms = true): Promise<void> {
    if (!this.pubsub) {
      throw new Error('You have to invoke init() before start()!')
    }
    let commsHaveConnectionPromise

    if (awaitComms) {
      commsHaveConnectionPromise = new Promise(resolve => {
        this.pubsub!.on('peer:joined', (peer) => {
          if (peer === this.peerId!.id) {
            this.logger.info('Pinning service joined PubSub. Lets start tests!')
            resolve()
          }
        })
      })
    }

    // Run Pinning service
    const appOptions = Object.assign({
      errorHandler: errorHandlerStub,
      appResetCallback: appResetCallbackSpy
    }, options, { contractAddress: this.contract?.options.address }) as AppOptions
    this.app = await initApp(this.providerAddress, appOptions)
    this.logger.info('Pinning service started, waiting for joing comms')

    if (awaitComms) {
      await commsHaveConnectionPromise
    }
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

    const encodedPeerId = encodeHash(this.peerId!.id).map(el => el.replace('0x', ''))
    const prefixedMsg = prefixArray(encodedPeerId, '01', 64)
      .map(el => `0x${el}`)

    const offerCall = this.contract
      .methods
      .setOffer(1000000, [1, 100], [10, 80], prefixedMsg)
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

  private awaitForMessage<T> (listener: Listener<T>, code?: MessageCodesEnum, timeout = 3000): Promise<T> {
    let resolved = false
    return Promise.race<T>([
      new Promise<T>(resolve => {
        const handler = (msg: T) => {
          if ((msg as unknown as Message<CommsMessage<unknown>>)?.data?.code === code) {
            resolve(msg)
            resolved = true
            listener.off('message', handler)
          }
        }
        listener.on('message', handler)
      }),
      (async (): Promise<T> => {
        await sleep(timeout)

        // Lets throw only when needed
        if (!resolved) {
          throw new Error(`Waiting for message with code ${code} timed out!`)
        }

        return {} as T
      })()
    ])
  }

  public async awaitForPubSubMessage<T> (code: MessageCodesEnum, timeout = 3000): Promise<CommsMessage<T>> {
    return (await this.awaitForMessage<Message<CommsMessage<T>>>(this.pubsub!, code, timeout)).data
  }

  public awaitForDirectMessage<T> (timeout = 3000): Promise<MessageDirect<T>> {
    return this.awaitForMessage(this.direct!, undefined, timeout)
  }

  public async sendDirectMessageToPinner (msg: any): Promise<void> {
    await this.direct?.sendTo(this.peerId!.id, msg)
  }
}
