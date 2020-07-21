import config from 'config'
import feathers from '@feathersjs/feathers'
import socketio from '@feathersjs/socketio'
import { Server } from 'http'

class FakeOffersService {
}

class FakeAgreementsService {
}

export class FakeCacheService {
  private readonly port: number

  public cacheServer: Server | undefined
  public offersService: any
  public agreementsService: any

  constructor (port: number) {
    this.port = port ?? 3030
    this.offersService = new FakeOffersService()
    this.agreementsService = new FakeAgreementsService()
  }

  run (): Promise<void> {
    // start feather server
    const app = feathers()
    app.configure(socketio())

    const offerPath = config.get<string>('cache.offer')
    const agreementPath = config.get<string>('cache.agreement')

    // Initialize Offer service
    app.use(offerPath, this.offersService)
    app.service(offerPath)

    // Initialize Agreement service
    app.use(agreementPath, this.agreementsService)
    app.service(agreementPath)

    const _cacheServer = app.listen(this.port)
    this.cacheServer = _cacheServer

    return new Promise(resolve => {
      _cacheServer.on('listening', () => resolve())
    })
  }

  stop (): void {
    this.cacheServer?.close()
  }
}
