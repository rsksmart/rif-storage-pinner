import { flags } from '@oclif/command'
import { OutputFlags } from '@oclif/parser'

import BaseCommand from '../utils'
import Agreement from '../models/agreement.model'
import { loggingFactory } from '../logger'

const logger = loggingFactory('cli:agreements')

export default class AgreementsCommand extends BaseCommand {
  static flags = {
    ...BaseCommand.flags,
    filter: flags.string({
      char: 'f',
      description: 'Filter by status',
      options: ['active', 'inactive'],
      multiple: true
    }),
    ls: flags.boolean({
      description: 'Show list of agreements'
    }),
    ref: flags.string({
      char: 'r',
      description: 'Find agreement by reference'
    }),
    sort: flags.string({ description: 'property to sort by (prepend \'-\' for descending)' })
  }

  static description = 'Agreements info'

  static examples = [
    '$ rif-pinning agreements --ls',
    '$ rif-pinning agreements --ls --db myOffer.sqlite -f active -f pending',
    '$ rif-pinning agreements --ls -f pending'
  ]

  agreementCommand () {
    const { flags } = this.parsedArgs
  }

  async agreementLsCommand () {
    const { flags: { sort, filter } } = this.parsedArgs
    const options = { where: {} } as Record<string, any>

    if (filter && filter.length && !(filter.includes('active') && filter.includes('inactive'))) {
      options.where.isActive = filter.includes('active')
    }

    this.table(
      await Agreement.findAll(options),
      {
        isActive: {
          header: 'Status',
          minWidth: 10,
          get: row => row.isActive ? 'active' : 'inactive'
        },
        dataReference: {
          header: 'Reference',
          minWidth: 54
        },
        size: {
          minWidth: 6
        },
        billingPeriod: {
          header: 'Billing Period',
          minWidth: 16
        },
        lastPayout: {
          minWidth: 26
        },
        agreementReference: {
          header: 'Agreement Ref'
        }
      },
      { sort }
    )
  }

  // eslint-disable-next-line require-await
  async run (): Promise<void> {
    const { flags } = this.parsedArgs

    if (flags.ls) return this.agreementLsCommand()

    if (flags.ref) return this.agreementCommand()
    return this._help()
  }
}
