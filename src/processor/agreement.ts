import type { EventData } from 'web3-eth-contract'
import type { Eth } from 'web3-eth'
import { soliditySha3 } from 'web3-utils'

import type { Handler } from '../definitions'
import { loggingFactory } from '../logger'
import { EventError } from '../errors'
import { decodeByteArray } from '../utils'
import { getBlockDate } from '../blockchain/utils'

import Agreement from '../models/agreement.model'
import type { ProviderManager } from '../providers'
import {
  AgreementFundsDeposited, AgreementFundsPayout, AgreementFundsWithdrawn,
  AgreementStopped,
  NewAgreement
} from '@rsksmart/rif-marketplace-storage/types/web3-v1-contracts/StorageManager'

const logger = loggingFactory('processor:agreement')

const handlers = {
  async NewAgreement (event: NewAgreement, eth: Eth, manager?: ProviderManager): Promise<void> {
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
      lastPayout: await getBlockDate(eth, event.blockNumber)
    }

    if (manager) await manager.pin(dataReference, parseInt(data.size))

    await Agreement.upsert(data) // Agreement might already exist
    logger.info(`Created new Agreement with ID ${id} for offer ${offerId}`)
  },

  async AgreementStopped (event: AgreementStopped, eth: Eth, manager?: ProviderManager): Promise<void> {
    const id = event.returnValues.agreementReference
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementStopped')
    }

    if (manager) await manager.unpin(agreement.dataReference)

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

  async AgreementFundsPayout (event: AgreementFundsPayout, eth: Eth): Promise<void> {
    const id = event.returnValues.agreementReference
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsWithdrawn')
    }

    agreement.lastPayout = await getBlockDate(eth, event.blockNumber)
    agreement.availableFunds -= parseInt(event.returnValues.amount)
    await agreement.save()

    logger.info(`${event.returnValues.amount} was payed out from funds of Agreement ${id}.`)
  }
}

function isValidEvent (value: string): value is keyof typeof handlers {
  return value in handlers
}

const handler: Handler = {
  events: ['NewAgreement', 'AgreementFundsDeposited', 'AgreementFundsWithdrawn', 'AgreementFundsPayout', 'AgreementStopped'],
  process (event: EventData, eth: Eth, manager?: ProviderManager): Promise<void> {
    if (!isValidEvent(event.event)) {
      return Promise.reject(new Error(`Unknown event ${event.event}`))
    }

    return handlers[event.event](event as any, eth, manager)
  }
}
export default handler
