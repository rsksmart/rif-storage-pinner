import config from 'config'
import { promises as fs } from 'fs'
import path from 'path'
import { AbiItem } from 'web3-utils'
import { getObject } from 'sequelize-store'
import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import { initStore } from './store'
import { sequelizeFactory } from './sequelize'
import { ethFactory, getEventsEmitter } from './blockchain/utils'
import { loggingFactory } from './logger'
import { ErrorHandler, getProcessor, precache } from './processor'
import { ProviderManager } from './providers'
import { IpfsProvider } from './providers/ipfs'

interface AppOptions {
  removeCache?: boolean
  forcePrecache?: boolean
  errorHandler?: ErrorHandler
}

export default async (offerId: string, options?: AppOptions) => {
  const logger = loggingFactory()

  if (!offerId) throw new Error('Offer id is required')

  if (options?.removeCache) {
    await fs
      .unlink(path.join(process.cwd(), config.get<string>('db')))
      .catch(e => logger.info(e.message))
  }

  const sequelize = await sequelizeFactory(config.get<string>('db'))
  await initStore(sequelize)
  const store = getObject()

  const manager = new ProviderManager()

  const ipfs = await IpfsProvider.bootstrap(config.get<string>('ipfs.connection'))
  manager.register(ipfs)

  const eth = ethFactory()
  const eventEmitter = getEventsEmitter(eth, storageManagerContractAbi.abi as AbiItem[])

  eventEmitter.on('error', (e: Error) => {
    loggingFactory().error(`There was unknown error in the blockchain's Events Emitter! ${e}`)
  })

  // If not set then it is first time running ==> precache
  if (!store.lastFetchedBlockNumber && !options?.forcePrecache) {
    await precache(eventEmitter, manager, getProcessor(offerId, eth))
  }

  eventEmitter.on('newEvent', getProcessor(offerId, eth, manager, { errorHandler: options?.errorHandler }))

  return { ipfs, providerManager: manager, eth, sequelize }
}