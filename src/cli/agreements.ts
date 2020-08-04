import { flags } from '@oclif/command'
import { Op } from 'sequelize'

import BaseCommand from '../utils'
import Agreement from '../models/agreement.model'
import { loggingFactory } from '../logger'
import JobModel from '../models/job.model'
import { JobState } from '../definitions'

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
    sort: flags.string({ description: 'property to sort by (prepend \'-\' for descending)' })
  }

  static description = 'Agreements info'

  static examples = [
    '$ rif-pinning agreements --ls',
    '$ rif-pinning agreements --ls --db myOffer.sqlite -f active -f pending',
    '$ rif-pinning agreements --ls -f pending'
  ]

  static getStatus (agreement: Agreement & { jobs: JobModel[] }): string {
    return agreement.isActive && agreement.hasSufficientFunds ? 'ACTIVE' : 'INACTIVE'
  }

  static getJobInfo (agreement: Agreement & { jobs: JobModel[] }): string {
    const [latestJob] = agreement.jobs

    if (!latestJob) return ''

    if (latestJob.state === JobState.ERRORED) return `ERRORED(retries: ${latestJob.retry}) - ${latestJob.errorMessage}`
    return latestJob.state.toUpperCase()
  }

  static expireIn (agreement: Agreement): string {
    const expired = agreement.expiredIn
    return expired > 0 ? `${expired} min` : 'now'
  }

  async queryAgreement (filterStatus: string[] = []) {
    const options = { where: {} } as Record<string, any>

    if (filterStatus && filterStatus.length && !(filterStatus.includes('active') && filterStatus.includes('inactive'))) {
      options.where.isActive = filterStatus.includes('active')
    }

    // TODO write raw query to improve performance
    const agreements = await Agreement.findAll(options) as any[]
    const jobs = await JobModel.findAll({
      raw: true,
      order: [['finish', 'DESC']],
      where: { name: { [Op.in]: agreements.map(a => a.dataReference) } }
    })

    return agreements.map(
      agreement => Object.assign(
        agreement,
        { jobs: jobs.filter(j => j.name === agreement.dataReference) || [] }
      )
    )
  }

  async agreementLsCommand () {
    const { flags: { sort, filter } } = this.parsedArgs

    this.table(
      await this.queryAgreement(filter),
      {
        dataReference: {
          header: 'Hash',
          minWidth: 54
        },
        size: {
          extended: true,
          minWidth: 6
        },
        billingPeriod: {
          extended: true,
          header: 'Billing Period',
          minWidth: 16
        },
        lastPayout: {
          extended: true,
          minWidth: 26
        },
        agreementReference: {
          header: 'Reference',
          minWidth: 68
        },
        isActive: {
          header: 'Status',
          minWidth: 10,
          get: AgreementsCommand.getStatus
        },
        expired: {
          header: 'Expire in',
          get: AgreementsCommand.expireIn
        },
        info: {
          get: AgreementsCommand.getJobInfo
        }
      },
      { sort }
    )
  }

  // eslint-disable-next-line require-await
  async run (): Promise<void> {
    const { flags } = this.parsedArgs

    if (flags.ls) return this.agreementLsCommand()

    return this.agreementLsCommand()
  }
}
