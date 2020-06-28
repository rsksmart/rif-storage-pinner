import { init } from 'sequelize-store'
import type { Sequelize } from 'sequelize'

export function initStore (sequelize: Sequelize): Promise<void> {
  return init(sequelize, {
    lastFetchedBlockNumber: 'int',
    lastFetchedBlockHash: 'string',
    lastProcessedBlockNumber: 'int',
    lastProcessedBlockHash: 'string',
    totalCapacity: 'int',
    peerId: 'string'
  })
}
