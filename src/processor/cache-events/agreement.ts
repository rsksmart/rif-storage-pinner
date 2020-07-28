import { loggingFactory } from '../../logger'
import type {
  BaseEventProcessorOptions,
  CacheEvent,
  HandlersObject
} from '../../definitions'
import { buildHandler } from '../../utils'
import Agreement from '../../models/agreement.model'
import { EventError } from '../../errors'

const logger = loggingFactory('processor:cache:agreement')

const handlers: HandlersObject<CacheEvent, BaseEventProcessorOptions> = {
  async NewAgreement (event: CacheEvent, options: BaseEventProcessorOptions): Promise<void> {
    const newAgreement = event.payload

    await Agreement.upsert(newAgreement) // Agreement might already exist
    logger.info(`Created new Agreement with ID ${newAgreement.agreementReference} for offer ${newAgreement.offerId}`)

    if (options.manager) await options.manager.pin(newAgreement.dataReference, parseInt(newAgreement.size))
  },

  async AgreementStopped (event: CacheEvent, options: BaseEventProcessorOptions): Promise<void> {
    const { agreementReference } = event.payload
    const agreement = await Agreement.findByPk(agreementReference)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${agreementReference} was not found!`, 'AgreementStopped')
    }

    agreement.isActive = false
    await agreement.save()

    if (options.manager) await options.manager.unpin(agreement.dataReference)

    logger.info(`Agreement ${agreementReference} was stopped.`)
  },

  async AgreementFundsDeposited (event: CacheEvent): Promise<void> {
    const { agreementReference: id, availableFunds } = event.payload
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsDeposited')
    }

    agreement.availableFunds = parseInt(availableFunds)
    await agreement.save()

    logger.info(`Agreement ${id} was topped up with ${availableFunds}.`)
  },

  async AgreementFundsWithdrawn (event: CacheEvent): Promise<void> {
    const { agreementReference: id, availableFunds } = event.payload
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsWithdrawn')
    }

    agreement.availableFunds = parseInt(availableFunds)
    await agreement.save()

    logger.info(`${availableFunds} was withdrawn from funds of Agreement ${id}.`)
  },

  async AgreementFundsPayout (event: CacheEvent): Promise<void> {
    const { agreementReference: id, availableFunds, lastPayout } = event.payload
    const agreement = await Agreement.findByPk(id)

    if (!agreement) {
      throw new EventError(`Agreement with ID ${id} was not found!`, 'AgreementFundsWithdrawn')
    }

    agreement.lastPayout = lastPayout
    agreement.availableFunds = parseInt(availableFunds)
    await agreement.save()

    logger.info(`${availableFunds} was payed out from funds of Agreement ${id}.`)
  }
}

export default buildHandler<CacheEvent, BaseEventProcessorOptions>(
  handlers,
  ['NewAgreement', 'AgreementFundsDeposited', 'AgreementFundsWithdrawn', 'AgreementFundsPayout', 'AgreementStopped']
)
