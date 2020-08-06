import { flags } from '@oclif/command'
import { OutputFlags } from '@oclif/parser'

import { loggingFactory } from '../logger'
import BaseCommand from '../utils'
import DbMigration from '../../migrations'

const logger = loggingFactory('cli:db')

export default class DbCommand extends BaseCommand {
  static hidden: boolean;
  static flags = {
    ...BaseCommand.flags,
    up: flags.boolean({
      char: 'm',
      description: 'Migrate DB'
    }),
    down: flags.boolean({
      char: 'u',
      description: 'Undo db migration'
    }),
    migration: flags.string({
      char: 'm',
      description: 'Migration file',
      multiple: true
    })
  }

  static description = 'DB migration'

  static examples = [
    '$ rif-pinning db --up',
    '$ rif-pinning db --down',
    '$ rif-pinning db --up --from 01-test --to -0-test',
    '$ rif-pinning db --up --migration 01-test --migration 02-test',
    '$ rif-pinning db --up --db ./test.sqlite --from 01-test --to 09-test',
    '$ rif-pinning db --down --db ./test.sqlite --from 01-test --to 09-test',
    '$ rif-pinning db --up --db ./test.sqlite --from 01-test --to 09-test'
  ]

  async migrate (migrations?: string[], options?: { from: string, to: string }): Promise<void> {
    this.spinner.start('DB migration')
    await DbMigration.getInstance().up(options)
    this.spinner.stop()
  }

  async undo (migrations?: string[], options?: { from: string, to: string }): Promise<void> {
    this.spinner.start('Undo DB migration')
    await DbMigration.getInstance().down(options)
    this.spinner.stop()
  }

  async run (): Promise<void> {
    const { flags: originalFlags } = this.parse(DbCommand)
    const flags = originalFlags as OutputFlags<typeof DbCommand.flags>

    if (!flags.up && !flags.down) throw new Error('--migrate or --undo flag required')

    if (flags.up && flags.down) throw new Error('Required one of [--migrate, --undo]')

    if (flags.up) await this.migrate(flags.migration)

    if (flags.down) await this.undo(flags.migration)
    this.exit()
  }
}
