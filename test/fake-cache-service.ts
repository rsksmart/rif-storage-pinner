import config from 'config'
import sinon from 'sinon'
import feathers from '@feathersjs/feathers'
import express from '@feathersjs/express'
import socketio from '@feathersjs/socketio'
import { Server } from 'http'

import { loggingFactory } from '../src/logger'
import { providerAddress } from './utils'

const logger = loggingFactory('test:fake-cache')

interface StubService {
  [key: string]: any
}

const serviceFunctions = ['get', 'find', 'create', 'remove', 'update', 'patch']

const createStubService = () => serviceFunctions.reduce((acc, key) => ({ ...acc, [key]: sinon.stub() }), {})
export const stubResetFunctions = (obj: Record<string, any>) =>
  Object.keys(obj).forEach(key => {
    obj[key].resetBehavior()
    obj[key].resetHistory()
  })

export const stubOffer: StubService = createStubService()
export const stubAgreement: StubService = createStubService()

export const mockOffer = (agreement: Record<string, any> = {}) => Object.assign({
  peerId: 'testPeerId',
  totalCapacity: 999999,
  address: providerAddress
}, agreement)

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
  lastPayout: new Date(),
  expiredAtBlockNumber: 999999
}, agreement)

function storageChannels (app: any): void {
  if (typeof app.channel !== 'function') {
    // If no real-time functionality has been configured just return
    return
  }
  app.on('connection', (connection: any) => {
    app.channel('storage_agreements').join(connection)
    app.channel('storage_offers').join(connection)
  })
  app.service(config.get<string>('cache.offers')).publish(() => app.channel('storage_offers'))
  app.service(config.get<string>('cache.agreements')).publish(() => app.channel('storage_agreements'))
}

export class FakeCacheService {
  private readonly port: number

  public app: any
  public cacheServer: Server | undefined
  public offerPath = config.get<string>('cache.offers')
  public agreementPath = config.get<string>('cache.agreements')

  constructor (port?: number) {
    this.port = port ?? 3030
  }

  get offerService () {
    return this.app.service(this.offerPath)
  }

  get agreementService () {
    return this.app.service(this.agreementPath)
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
