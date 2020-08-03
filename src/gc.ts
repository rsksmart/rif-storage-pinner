import { BlockHeader } from 'web3-eth'
import config from 'config'

import Agreement from './models/agreement.model'
import { Op } from 'sequelize'
import { ProviderManager } from './providers'
import { loggingFactory } from './logger'

const logger = loggingFactory('gc')

/**
 * This is a closure that garbage-collects pins of expired Agreements.
 *
 * When first detects an Agreement to have no funds it saves the block number at what it was detected.
 * Then after number of blocks specified for confirmations it actualy unpins the data.
 *
 * This is in order to handle case when reorg happens and the DepositFunds event is emitted in the
 * confirmation range.
 *
 * @param manager
 */
export function collectPinsClosure (manager: ProviderManager) {
  return async (block: BlockHeader): Promise<void> => {
    logger.verbose('Running pinning GC')

    const nonExpiredAgreements = await Agreement.findAll({ where: { expiredAtBlockNumber: null, isActive: true } })
    for (const agreement of nonExpiredAgreements) {
      if (!agreement.hasSufficientFunds) {
        logger.info(`Marking agreement ${agreement.agreementReference} to be collected at block ${block.number}.`)
        agreement.expiredAtBlockNumber = block.number
        await agreement.save()
      }
    }

    const agreementsToUnpins = await Agreement.findAll({
      where: {
        expiredAtBlockNumber: {
          [Op.lte]: block.number - config.get<number>('blockchain.eventsEmitter.confirmations')
        },
        isActive: true
      }
    })
    for (const agreement of agreementsToUnpins) {
      if (agreement.hasSufficientFunds) { // Agreement received funds in meanwhile, lets continue!
        agreement.expiredAtBlockNumber = null
      } else { // Agreement is still without funds!
        logger.info(`Unpinning agreement ${agreement.agreementReference}.`)
        await manager.unpin(agreement.dataReference)
        agreement.isActive = false
      }
      await agreement.save()
    }
  }
}
