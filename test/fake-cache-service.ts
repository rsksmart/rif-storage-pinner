import config from 'config'
import sinon from 'sinon'
import feathers, { Service } from '@feathersjs/feathers'
import express from '@feathersjs/express'
import socketio from '@feathersjs/socketio'
import { Server } from 'http'

import { loggingFactory } from '../src/logger'
import { providerAddress } from './utils'

const logger = loggingFactory('test:fake-cache')

interface StubService {
  [key: string]: any
}

const FakeOffersService = {
  async find () {
    return await Promise.reject(Error('Not implemented'))
  },

  async get (): Promise<any> {
    return await Promise.reject(Error('Not implemented'))
  },

  async create () {
    return await Promise.reject(Error('Not implemented3'))
  },

  async update () {
    return await Promise.reject(Error('Not implemented4'))
  },

  async patch () {
    return await Promise.reject(Error('Not implemented5'))
  },

  async remove () {
    return await Promise.reject(Error('Not implemented6'))
  }
}
const FakeAgreementsService = {
  async find (): Promise<any> {
    return await Promise.reject(Error('Not implemented'))
  },

  async get () {
    return await Promise
      .resolve({ peerId: 'testPeerId', totalCapacity: 999999, address: '0xB22230f21C57f5982c2e7C91162799fABD5733bE' })
  },

  async create () {
    return await Promise.reject(Error('Not implemented'))
  },

  async update () {
    return await Promise.reject(Error('Not implemented'))
  },

  async patch () {
    return await Promise.reject(Error('Not implemented'))
  },

  async remove () {
    return await Promise.reject(Error('Not implemented'))
  }
}

const stubObjectFunctions = (obj: Record<string, Function>) =>
  Object.keys(obj).reduce((acc, key) => ({ ...acc, [key]: sinon.stub() }), {})

export const stubResetFunctions = (obj: Record<string, any>) =>
  Object.keys(obj).forEach(key => obj[key].resetBehavior())

export const stubOffer: StubService = stubObjectFunctions(FakeOffersService)
export const stubAgreement: StubService = stubObjectFunctions(FakeAgreementsService)

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
  billingPrice: 10,
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
    logger.info('New connection to fakeApp: ', connection)
    app.channel('storage_agreements').join(connection)
    app.channel('storage_offers').join(connection)
  })
  app.service(config.get<string>('cache.offers')).publish(() => app.channel('storage_offers'))
  app.service(config.get<string>('cache.agreements')).publish(() => app.channel('storage_agreements'))
}

export class FakeCacheService {
  private readonly port: number

  public cacheServer: Server | undefined
  public storageServices: Record<'offer' | 'agreement', Service<any>> | undefined

  constructor (port?: number) {
    this.port = port ?? 3030
  }

  run (): Promise<void> {
    // start feather server
    const app = express(feathers())
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))

    app.configure(socketio())

    const offerPath = config.get<string>('cache.offers')
    const agreementPath = config.get<string>('cache.agreements')

    // Initialize Offer service
    app.use(offerPath, stubOffer)
    app.service(offerPath)

    // Initialize Agreement service
    app.use(agreementPath, stubAgreement)
    app.service(agreementPath)

    app.configure(storageChannels)

    const _cacheServer = app.listen(this.port)
    this.cacheServer = _cacheServer
    this.storageServices = {
      offer: app.service(offerPath),
      agreement: app.service(agreementPath)
    }
    logger.info('Start listening on port ' + this.port)

    return new Promise(resolve => {
      _cacheServer.on('listening', () => resolve())
    })
  }

  stop (): void {
    this.cacheServer?.close()
  }
}
