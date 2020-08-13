import BigNumber from 'bignumber.js'

import { loggingFactory } from '../../logger'
import type {
  BaseEventProcessorOptions,
  MarketplaceEvent,
  HandlersObject
} from '../../definitions'
import { buildHandler } from '../../utils'
import Agreement from '../../models/agreement.model'
import { EventError } from '../../errors'
import { channel, MessageCodesEnum } from '../../communication'

const logger = loggingFactory('processor:cache:agreement')

const handlers: HandlersObject<MarketplaceEvent, BaseEventProcessorOptions> = {
  async NewAgreement (event: MarketplaceEvent, options: BaseEventProcessorOptions): Promise<void> {
    const newAgreement = event.payload

    const [agreement] = await Agreement.upsert(newAgreement) // Agreement might already exist
    logger.info(`Created new Agreement with ID ${newAgreement.agreementReference} for offer ${newAgreement.offerId}`)

    if (options.manager) {
      await options.manager.pin(newAgreement.dataReference, agreement.size)
      channel.broadcast(MessageCodesEnum.I_AGREEMENT_NEW, { agreementReference: newAgreement.agreementReference })
    }
  },

  async AgreementStopped (event: MarketplaceEvent, options: BaseEventProcessorOptions): Promise<void> {
    const { agreementReference } = event.payload
    const agreement = await Agreement.findByPk(agreementReference)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${agreementReference} was not found!`, 'AgreementStopped')
    }

    agreement.isActive = false
    await agreement.save()

    if (options.manager) {
      await options.manager.unpin(agreement.dataReference)
      channel.broadcast(MessageCodesEnum.I_AGREEMENT_STOPPED, { agreementReference: agreement.agreementReference })
    }

    logger.info(`Agreement ${agreementReference} was stopped.`)
  },

  async AgreementFundsDeposited (event: MarketplaceEvent): Promise<void> {
    const { agreementReference: id, availableFunds } = event.payload
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsDeposited')
    }

    agreement.availableFunds = new BigNumber(availableFunds)
    await agreement.save()

    logger.info(`Agreement ${id} was topped up with ${availableFunds}.`)
  },

  async AgreementFundsWithdrawn (event: MarketplaceEvent): Promise<void> {
    const { agreementReference: id, availableFunds } = event.payload
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsWithdrawn')
    }

    agreement.availableFunds = new BigNumber(availableFunds)
    await agreement.save()

    logger.info(`${availableFunds} was withdrawn from funds of Agreement ${id}.`)
  },

  async AgreementFundsPayout (event: MarketplaceEvent): Promise<void> {
    const { agreementReference: id, availableFunds, lastPayout } = event.payload
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsWithdrawn')
    }

    agreement.lastPayout = lastPayout
    agreement.availableFunds = new BigNumber(availableFunds)
    await agreement.save()

    logger.info(`${availableFunds} was payed out from funds of Agreement ${id}.`)
  }
}

export default buildHandler<MarketplaceEvent, BaseEventProcessorOptions>(
  handlers,
  ['NewAgreement', 'AgreementFundsDeposited', 'AgreementFundsWithdrawn', 'AgreementFundsPayout', 'AgreementStopped']
)
