import { soliditySha3 } from 'web3-utils'

import {
  AgreementFundsDeposited, AgreementFundsPayout, AgreementFundsWithdrawn,
  AgreementStopped,
  NewAgreement
} from '@rsksmart/rif-marketplace-storage/types/web3-v1-contracts/StorageManager'

import { loggingFactory } from '../../logger'
import { EventError } from '../../errors'
import { decodeByteArray } from '../../utils'
import { getBlockDate } from '../../blockchain/utils'
import Agreement from '../../models/agreement.model'
import type { Handler, BlockchainEventProcessorOptions, BlockchainAgreementEvents } from '../../definitions'

const logger = loggingFactory('processor:blockchain:agreement')

const handlers = {
  async NewAgreement (event: NewAgreement, options: BlockchainEventProcessorOptions): Promise<void> {
    const { provider: offerId } = event.returnValues
    const id = soliditySha3(event.returnValues.agreementCreator, ...event.returnValues.dataReference)
    const dataReference = decodeByteArray(event.returnValues.dataReference)

    const data = {
      agreementReference: id,
      dataReference,
      consumer: event.returnValues.agreementCreator,
      offerId: offerId,
      size: event.returnValues.size,
      billingPeriod: event.returnValues.billingPeriod,
      billingPrice: event.returnValues.billingPrice,
      availableFunds: event.returnValues.availableFunds,
      expiredAtBlockNumber: null, // If not new, then lets reset the expiredAt column
      lastPayout: await getBlockDate(options.eth, event.blockNumber)
    }

    if (options.manager) await options.manager.pin(dataReference, parseInt(data.size))

    await Agreement.upsert(data) // Agreement might already exist
    logger.info(`Created new Agreement with ID ${id} for offer ${offerId}`)
  },

  async AgreementStopped (event: AgreementStopped, options: BlockchainEventProcessorOptions): Promise<void> {
    const id = event.returnValues.agreementReference
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementStopped')
    }

    if (options.manager) await options.manager.unpin(agreement.dataReference)

    agreement.isActive = false
    await agreement.save()

    logger.info(`Agreement ${id} was stopped.`)
  },

  async AgreementFundsDeposited (event: AgreementFundsDeposited): Promise<void> {
    const id = event.returnValues.agreementReference
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsDeposited')
    }

    agreement.availableFunds += parseInt(event.returnValues.amount)
    await agreement.save()

    logger.info(`Agreement ${id} was topped up with ${event.returnValues.amount}.`)
  },

  async AgreementFundsWithdrawn (event: AgreementFundsWithdrawn): Promise<void> {
    const id = event.returnValues.agreementReference
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsWithdrawn')
    }

    agreement.availableFunds -= parseInt(event.returnValues.amount)
    await agreement.save()

    logger.info(`${event.returnValues.amount} was withdrawn from funds of Agreement ${id}.`)
  },

  async AgreementFundsPayout (event: AgreementFundsPayout, options: BlockchainEventProcessorOptions): Promise<void> {
    const id = event.returnValues.agreementReference
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsWithdrawn')
    }

    agreement.lastPayout = await getBlockDate(options.eth, event.blockNumber)
    agreement.availableFunds -= parseInt(event.returnValues.amount)
    await agreement.save()

    logger.info(`${event.returnValues.amount} was payed out from funds of Agreement ${id}.`)
  }
}

function isValidEvent<T> (value: string): value is keyof typeof handlers {
  return value in handlers
}

const handler: Handler<BlockchainAgreementEvents, BlockchainEventProcessorOptions> = {
  events: ['NewAgreement', 'AgreementFundsDeposited', 'AgreementFundsWithdrawn', 'AgreementFundsPayout', 'AgreementStopped'],
  process (event: BlockchainAgreementEvents, options?: BlockchainEventProcessorOptions): Promise<void> {
    if (!isValidEvent(event.event)) {
      return Promise.reject(new Error(`Unknown event ${event.event}`))
    }

    return handlers[event.event](event, options || {} as BlockchainEventProcessorOptions)
  }
}
export default handler
