import config from 'config'
import { promises as fs } from 'fs'
import path from 'path'
import type { AbiItem } from 'web3-utils'
import { getObject } from 'sequelize-store'
import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import { initStore } from './store'
import { sequelizeFactory } from './sequelize'
import { ethFactory, getEventsEmitter, getNewBlockEmitter } from './blockchain/utils'
import { loggingFactory } from './logger'
import { getProcessor, precache } from './processor'
import { ProviderManager } from './providers'
import { IpfsProvider } from './providers/ipfs'
import { AppOptions } from './definitions'
import { collectPinsClosure } from './gc'
import { errorHandler } from './utils'

export default async (offerId: string, options?: AppOptions): Promise<{ stop: () => void }> => {
  const logger = loggingFactory()

  if (!offerId) throw new Error('Offer id is required')

  // dataDir is set when entry point is CLI, for testing we have also the CWD option.
  const dbPath = path.join(options?.dataDir ?? process.cwd(), config.get<string>('db'))
  logger.verbose(`Using database path ${dbPath}`)

  if (options?.removeCache) {
    await fs
      .unlink(dbPath)
      .catch(e => logger.info(e.message))
  }

  const sequelize = await sequelizeFactory(dbPath)
  await initStore(sequelize)
  const store = getObject()

  const manager = new ProviderManager()
  const ipfs = await IpfsProvider.bootstrap(config.get<string>('ipfs.connection'))
  manager.register(ipfs)

  const eth = ethFactory()
  const newBlockEmitter = getNewBlockEmitter(eth)
  const eventEmitter = getEventsEmitter(eth, storageManagerContractAbi.abi as AbiItem[], { newBlockEmitter, contractAddress: options?.contractAddress })

  eventEmitter.on('error', (e: Error) => {
    logger.error(`There was unknown error in the blockchain's Events Emitter! ${e}`)
  })

  // If not set then it is first time running ==> precache
  if (!store.lastFetchedBlockNumber && !options?.forcePrecache) {
    await precache(eventEmitter, manager, getProcessor(offerId, eth))
  }

  eventEmitter.on('newEvent', getProcessor(offerId, eth, manager, { errorHandler: options?.errorHandler }))

  // Pinning Garbage Collecting
  newBlockEmitter.on('newBlock', errorHandler(collectPinsClosure(manager), loggingFactory('gc')))

  return { stop: (): void => eventEmitter.stop() }
}
