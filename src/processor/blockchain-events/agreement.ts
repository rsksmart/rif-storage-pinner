import { soliditySha3 } from 'web3-utils'
import BigNumber from 'bignumber.js'
import type Eth from 'web3-eth'

import {
  AgreementFundsDeposited, AgreementFundsPayout, AgreementFundsWithdrawn,
  AgreementStopped,
  NewAgreement
} from '@rsksmart/rif-marketplace-storage/types/web3-v1-contracts/StorageManager'

import { loggingFactory } from '../../logger'
import { EventError, NotPinnedError } from '../../errors'
import { buildHandler, decodeByteArray } from '../../utils'
import Agreement from '../../models/agreement.model'
import type {
  BlockchainEventProcessorOptions,
  BlockchainAgreementEventsWithNewAgreement, HandlersObject
} from '../../definitions'
import { MessageCodesEnum } from '../../definitions'
import { broadcast } from '../../communication'

const logger = loggingFactory('processor:blockchain:agreement')

async function getBlockDate (eth: Eth, blockNumber: number): Promise<Date> {
  return new Date(((await eth.getBlock(blockNumber)).timestamp as number) * 1000)
}

const handlers: HandlersObject<BlockchainAgreementEventsWithNewAgreement, BlockchainEventProcessorOptions> = {
  async NewAgreement (event: BlockchainAgreementEventsWithNewAgreement, options: BlockchainEventProcessorOptions): Promise<void> {
    const {
      blockNumber,
      returnValues: {
        provider: offerId,
        agreementCreator: consumer,
        dataReference: dReference,
        size,
        billingPeriod,
        billingPrice,
        token: tokenAddress,
        availableFunds
      }
    } = event as NewAgreement

    const agreementReference = soliditySha3(consumer, ...dReference, tokenAddress)
    const dataReference = decodeByteArray(dReference)

    const data = {
      agreementReference,
      dataReference,
      consumer,
      offerId,
      size,
      billingPeriod,
      billingPrice,
      availableFunds,
      token: tokenAddress,
      expiredAtBlockNumber: null, // If not new, then lets reset the expiredAt column
      lastPayout: await getBlockDate(options.eth, blockNumber)
    }

    const [agreement] = await Agreement.upsert(data) // Agreement might already exist
    logger.info(`Created new Agreement with ID ${agreementReference} for offer ${offerId}`)

    if (options.manager) {
      await broadcast(MessageCodesEnum.I_AGREEMENT_NEW, { agreementReference: agreementReference })
      await options.manager.pin(dataReference, agreement.size, agreement.agreementReference)
    }
  },

  async AgreementStopped (event: BlockchainAgreementEventsWithNewAgreement, options: BlockchainEventProcessorOptions): Promise<void> {
    const { returnValues: { agreementReference: id } } = event as AgreementStopped
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementStopped')
    }

    agreement.isActive = false
    await agreement.save()

    if (options.manager) {
      try {
        await options.manager.unpin(agreement.dataReference)
      } catch (e) {
        // We ignore not-pinned errors because the files might be already GCed
        if (e.code !== NotPinnedError.code) {
          throw e
        }
      }
      await broadcast(MessageCodesEnum.I_AGREEMENT_STOPPED, { agreementReference: agreement.agreementReference })
    }

    logger.info(`Agreement ${id} was stopped.`)
  },

  async AgreementFundsDeposited (event: BlockchainAgreementEventsWithNewAgreement): Promise<void> {
    const { returnValues: { agreementReference: id, amount } } = event as AgreementFundsDeposited
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsDeposited')
    }

    agreement.availableFunds = agreement.availableFunds.plus(new BigNumber(amount))
    await agreement.save()

    logger.info(`Agreement ${id} was topped up with ${amount}.`)
  },

  async AgreementFundsWithdrawn (event: BlockchainAgreementEventsWithNewAgreement): Promise<void> {
    const { returnValues: { agreementReference: id, amount } } = event as AgreementFundsWithdrawn
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsWithdrawn')
    }

    agreement.availableFunds = agreement.availableFunds.minus(new BigNumber(amount))
    await agreement.save()

    logger.info(`${amount} was withdrawn from funds of Agreement ${id}.`)
  },

  async AgreementFundsPayout (event: BlockchainAgreementEventsWithNewAgreement, options: BlockchainEventProcessorOptions): Promise<void> {
    const { blockNumber, returnValues: { agreementReference: id, amount } } = event as AgreementFundsPayout
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsWithdrawn')
    }

    agreement.lastPayout = await getBlockDate(options.eth, blockNumber)
    agreement.availableFunds = agreement.availableFunds.minus(new BigNumber(amount))
    await agreement.save()

    logger.info(`${amount} was payed out from funds of Agreement ${id}.`)
  }
}

export default buildHandler<BlockchainAgreementEventsWithNewAgreement, BlockchainEventProcessorOptions>(
  handlers
  , ['NewAgreement', 'AgreementFundsDeposited', 'AgreementFundsWithdrawn', 'AgreementFundsPayout', 'AgreementStopped']
)
