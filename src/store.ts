import { init, Schema } from 'sequelize-store'
import type { Sequelize } from 'sequelize'

function addBlockTrackerDefinitionFor (service: string, obj: Schema): void {
  obj[`web3events.${service}.lastFetchedBlockNumber`] = 'int'
  obj[`web3events.${service}.lastFetchedBlockHash`] = 'string'
  obj[`web3events.${service}.lastProcessedBlockNumber`] = 'int'
  obj[`web3events.${service}.lastProcessedBlockHash`] = 'string'
}

export function initStore (sequelize: Sequelize): Promise<void> {
  const schema = {
    totalCapacity: 'string',
    offerId: 'string',
    peerId: 'string',
    peerPrivKey: 'string',
    peerPubKey: 'string'
  } as Schema

  addBlockTrackerDefinitionFor('storage', schema)

  return init(sequelize, schema)
}
