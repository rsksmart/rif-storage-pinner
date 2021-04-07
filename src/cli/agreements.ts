import config from 'config'
import path from 'path'
import { flags } from '@oclif/command'
import { Op } from 'sequelize'
import LogSymbols from 'log-symbols'
import Table from 'cli-table3'
import colors from 'colors/safe'

import BaseCommand from '../utils'
import Agreement from '../models/agreement.model'
import JobModel from '../models/job.model'
import { JobState } from '../definitions'
import { IConfig } from '@oclif/config'
import { OutputFlags } from '@oclif/parser'

enum FilterStatus { active = 'active', inactive = 'inactive '}
type AgreementWithJobs = Agreement & { jobs: JobModel[] }
type AgreementFilters = { status?: FilterStatus, pinningStatus?: JobState[] }

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
    network: flags.string({
      char: 'n',
      description: 'specifies to which network is the provider connected',
      options: ['testnet', 'mainnet'],
      env: 'RIFS_NETWORK'
    }),
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
    super(argv, config, { db: { migrate: true } })
  }

  protected baseConfig (flags: OutputFlags<typeof AgreementsCommand.flags>): void {
    super.baseConfig(flags)
    const { userConfig, configObject } = this.configuration

    config.util.extendDeep(config, userConfig)
    config.util.extendDeep(config, configObject)

    if (flags.network) {
      const networkConfigPath = path.join(__dirname, '..', '..', 'config', `${flags.network}.json5`)
      config.util.extendDeep(config, config.util.parseFile(networkConfigPath))
    }
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
    const expired = agreement.expiresIn

    if (expired.gt(0) && expired.lt(agreement.billingPeriod.div(60).times(2))) {
      return colors.yellow(`${expired.toString()} min`)
    }

    return expired.gt(0)
      ? colors.green(`${expired.toString()} min`)
      : colors.red('EXPIRED')
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
      head: ['', 'Reference', 'Expire in', 'Pinning Status'].map(colors.bold),
      colWidths: [3, 68],
      colAligns: ['center', 'center', 'center', 'left'],
      wordWrap: true,
      style: { head: [] }
    })

    const agreements = await this.queryAgreement({ status, pinningStatus })

    table.push(...agreements.map(AgreementsCommand.prepareAgreementForTable))
    // eslint-disable-next-line no-console
    console.log(table.toString())

    this.exit()
  }
}
