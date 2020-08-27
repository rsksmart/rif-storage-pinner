import config from 'config'
import sinon from 'sinon'
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import socketio from '@feathersjs/socketio'
import { Server } from 'http'

import { loggingFactory } from '../src/logger'
import { providerAddress } from './utils'
import { REORG_EVENT } from '../src/processor/marketplace-events'

const logger = loggingFactory('test:fake-cache')

interface StubService {
  [key: string]: any
}

const serviceFunctions = ['get', 'find', 'create', 'remove', 'update', 'patch']
const createStubService = (service: Record<string, any> = {}) => serviceFunctions.reduce((acc, key) => ({ ...acc, [key]: sinon.stub() }), service)

export function stubResetFunctions (obj: Record<string, sinon.SinonStub>): void {
  Object.keys(obj).forEach(key => obj[key].reset())
}

export const stubOffer: StubService = createStubService()
export const stubAgreement: StubService = createStubService()
export const stubNewBlock: StubService = createStubService({ events: ['newBlock'] })
export const stubReorg: StubService = createStubService({ events: [REORG_EVENT] })

export function mockOffer (offer: Record<string, any> = {}): Record<string, any> {
  return Object.assign({
    peerId: 'testPeerId',
    totalCapacity: '999999',
    address: providerAddress
  }, offer)
}

export const mockAgreement = (agreement: Record<string, any> = {}) => Object.assign({
  agreementReference: '0x1233',
  offerId: providerAddress,
  dataReference: 'ipfs/123',
  size: 32,
  consumer: '0x1235',
  isActive: true,
  billingPeriod: 1,
  billingPrice: 999,
  availableFunds: 500,
  lastPayout: Date.now()
}, agreement)

function storageChannels (app: any): void {
  if (typeof app.channel !== 'function') {
    // If no real-time functionality has been configured just return
    return
  }
  app.on('connection', (connection: any) => {
    app.channel('storage_agreements').join(connection)
    app.channel('storage_offers').join(connection)
    app.channel('blockchain').join(connection)
    app.channel('reorg').join(connection)
  })
  app.service(config.get<string>('marketplace.offers')).publish(() => app.channel('storage_offers'))
  app.service(config.get<string>('marketplace.agreements')).publish(() => app.channel('storage_agreements'))
  app.service(config.get<string>('marketplace.newBlock')).publish(() => app.channel('blockchain'))
  app.service(config.get<string>('marketplace.reorg')).publish(() => app.channel('reorg'))
}

export class FakeMarketplaceService {
  private readonly port: number

  public app: any
  public cacheServer: Server | undefined
  public offerPath = config.get<string>('marketplace.offers')
  public agreementPath = config.get<string>('marketplace.agreements')
  public newBlockPath = config.get<string>('marketplace.newBlock')
  public reorgPath = config.get<string>('marketplace.reorg')

  constructor (port?: number) {
    this.port = port ?? 3030
  }

  get offerService () {
    return this.app.service(this.offerPath)
  }

  get agreementService () {
    return this.app.service(this.agreementPath)
  }

  get newBlockService () {
    return this.app.service(this.newBlockPath)
  }

  get reorgService () {
    return this.app.service(this.reorgPath)
  }

  run (): Promise<void> {
    // start feather server
    const app = express(feathers())
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))

    app.configure(socketio())

    // Initialize Offer service
    app.use(this.offerPath, stubOffer)
    app.service(this.offerPath)

    // Initialize Agreement service
    app.use(this.agreementPath, stubAgreement)
    app.service(this.agreementPath)

    // Init new block service
    app.use(this.newBlockPath, stubNewBlock)
    app.service(this.newBlockPath)

    // Init reorg service
    app.use(this.reorgPath, stubReorg)
    app.service(this.newBlockPath)

    app.configure(storageChannels)

    const _cacheServer = app.listen(this.port)
    this.app = app
    this.cacheServer = _cacheServer

    logger.info('Start listening on port ' + this.port)

    return new Promise(resolve => {
      _cacheServer.on('listening', () => resolve())
    })
  }

  stop (): void {
    this.cacheServer?.close()
  }
}
