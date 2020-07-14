import config from 'config'
import { AbiItem } from 'web3-utils'
import { getObject } from 'sequelize-store'
import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

import { initStore } from './store'
import { sequelizeFactory } from './sequelize'
import { ethFactory, getEventsEmitter } from './blockchain/utils'
import { loggingFactory } from './logger'
import { getProcessor, precache } from './processor'
import { ProviderManager } from './providers'
import { IpfsProvider } from './providers/ipfs'

export default async (offerId: string) => {
  if (!offerId) throw new Error('Offer id is required')

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
  if (!store.lastFetchedBlockNumber) {
    await precache(eventEmitter, manager, getProcessor(offerId, eth))
  }

  eventEmitter.on('newEvent', getProcessor(offerId, eth, manager))

  return { ipfs, providerManager: manager, eth, sequelize }
}
