import { flags } from '@oclif/command'
import { Op } from 'sequelize'
import LogSymbols from 'log-symbols'
import Table from 'cli-table3'
import colors from 'colors/safe'

import BaseCommand from '../utils'
import Agreement from '../models/agreement.model'
import { loggingFactory } from '../logger'
import JobModel from '../models/job.model'
import { JobState } from '../definitions'
import { IConfig } from '@oclif/config'

const logger = loggingFactory('cli:agreements')

type AgreementWithJobs = Agreement & { jobs: JobModel[] }
type AgreementFilters = { status?: FilterStatus, pinningStatus?: JobState[] }
enum FilterStatus { active = 'active', inactive = 'inactive '}

const statusFilter = (agreement: AgreementWithJobs, status: FilterStatus | undefined): boolean =>
  !status ||
  (status === FilterStatus.active && agreement.isActive) ||
  (status === FilterStatus.inactive && !agreement.isActive)

const pinningStatusFilter = (job: JobModel, pinningStatuses: JobState[] | undefined): boolean =>
  !pinningStatuses ||
  pinningStatuses.includes(job.state as JobState)

export default class AgreementsCommand extends BaseCommand {
  static flags = {
    ...BaseCommand.flags,
    status: flags.string({
      char: 's',
      description: 'Filter by status',
      options: ['active', 'inactive']
    }),
    pinningStatus: flags.string({
      char: 'p',
      description: 'Filter by pinning status',
      options: [JobState.RUNNING, JobState.BACKOFF, JobState.CREATED, JobState.FINISHED, JobState.ERRORED],
      multiple: true
    })
  }

  static description = 'Agreements info'

  static examples = [
    '$ rif-pinning agreements',
    '$ rif-pinning agreements --db myOffer.sqlite',
    '$ rif-pinning agreements --ls -f active',
    '$ rif-pinning agreements --ls -f inactive',
    '$ rif-pinning agreements --ls -f inactive -p pinned',
    '$ rif-pinning agreements --ls -f active -p not-pinned'
  ]

  constructor (argv: string[], config: IConfig) {
    super(argv, config, { db: { sync: false, migrate: true } })
  }

  static getStatus (agreement: Agreement): string {
    return agreement.isActive ? LogSymbols.success : LogSymbols.error
  }

  static getJobInfo (agreement: AgreementWithJobs): string {
    const [latestJob] = agreement.jobs

    if (!latestJob) return ''

    switch (latestJob.state) {
      case JobState.ERRORED:
        return colors.red(`ERRORED(retries: ${latestJob.retry}) - ${latestJob.errorMessage}`)
      case JobState.FINISHED:
        return colors.green(latestJob.state.toUpperCase())
      case JobState.CREATED:
      case JobState.BACKOFF:
      case JobState.RUNNING:
        return colors.yellow(latestJob.state.toUpperCase())
      default:
        return latestJob.state.toUpperCase()
    }
  }

  static expireIn (agreement: Agreement): string {
    const expired = agreement.expiredIn

    if (expired > 0 && expired < 2 * agreement.billingPeriod / 60) return colors.yellow(`${expired} min`)
    return expired > 0 ? colors.green(`${expired} min`) : colors.red('EXPIRED')
  }

  static prepareAgreementForTable (agreement: AgreementWithJobs): any[] {
    return [
      AgreementsCommand.getStatus(agreement),
      `${agreement.agreementReference} ${agreement.dataReference}`,
      AgreementsCommand.expireIn(agreement),
      AgreementsCommand.getJobInfo(agreement)
    ]
  }

  static filterAgreement (agreement: AgreementWithJobs, filters: AgreementFilters): Array<Agreement> {
    const { status, pinningStatus } = filters
    const [latestJob] = agreement.jobs

    return statusFilter(agreement, status) && pinningStatusFilter(latestJob, pinningStatus)
      ? [agreement]
      : []
  }

  async queryAgreement (filters: AgreementFilters = {}): Promise<Array<AgreementWithJobs>> {
    const agreements = await Agreement.findAll() as any[]
    const jobs = await JobModel.findAll({
      raw: true,
      order: [['finish', 'DESC']],
      where: { name: { [Op.in]: agreements.map(a => a.dataReference) } }
    })

    return agreements.reduce(
      (acc, agreement) => {
        agreement = Object.assign(
          agreement,
          {
            jobs: jobs.filter(j => j.name === agreement.dataReference) || [],
            isActive: agreement.hasSufficientFunds
          }
        )

        return [
          ...acc,
          ...AgreementsCommand.filterAgreement(agreement, filters)
        ]
      },
      []
    )
  }

  // eslint-disable-next-line require-await
  async run (): Promise<void> {
    const { flags: { status, pinningStatus } } = this.parsedArgs

    const table = new Table({
      head: ['', 'Reference', 'Expire in', 'Pinning Status'].map(t => colors.bold(t)),
      colWidths: [3, 68],
      colAligns: ['center', 'center', 'center', 'left'],
      wordWrap: true,
      style: { head: [] }
    })

    const data = (await this.queryAgreement({ status, pinningStatus })).map(AgreementsCommand.prepareAgreementForTable)

    table.push(...data)
    // eslint-disable-next-line no-console
    console.log(table.toString())

    this.exit()
  }
}
