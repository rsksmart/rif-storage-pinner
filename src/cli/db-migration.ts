import fs from 'fs'
import path from 'path'
import { flags } from '@oclif/command'
import { OutputFlags } from '@oclif/parser'

import { loggingFactory } from '../logger'
import BaseCommand from '../utils'
import { Migration } from '../migrations'

const logger = loggingFactory('cli:db-migration')

const MigrationTemplate = `import { QueryInterface } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'

export default {
  // eslint-disable-next-line require-await
  async up (queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    return Promise.reject(Error('Not implemented'))
  },
  // eslint-disable-next-line require-await
  async down (queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    return Promise.reject(Error('Not implemented'))
  }
}
`

export default class DbCommand extends BaseCommand {
  static hidden: boolean
  static flags = {
    ...BaseCommand.flags,
    up: flags.boolean({
      char: 'u',
      description: 'Migrate DB',
      exclusive: ['down', 'generate']
    }),
    down: flags.boolean({
      char: 'd',
      description: 'Undo db migration',
      exclusive: ['up', 'generate']
    }),
    generate: flags.string({
      char: 'd',
      description: 'Generate migrations using template [--generate=migration_name]',
      exclusive: ['up', 'down']
    }),
    to: flags.string({
      char: 't',
      description: 'Migrate to'
    }),
    migration: flags.string({
      char: 'm',
      description: 'Migration file',
      multiple: true
    })
  }

  static description = 'DB migration'

  static examples = [
    '$ rif-pinning db-migration --up',
    '$ rif-pinning db-migration --down',
    '$ rif-pinning db-migration --up --to 0-test',
    '$ rif-pinning db-migration --up --migration 01-test --migration 02-test',
    '$ rif-pinning db-migration --up --db ./test.sqlite --to 09-test',
    '$ rif-pinning db-migration --down --db ./test.sqlite --to 09-test',
    '$ rif-pinning db-migration --generate my_first_migration'
  ]

  async migrate (migrator: Migration, migrations?: string[], options?: { to: string }): Promise<void> {
    if (!(await migrator.pending()).length) {
      this.log('No pending migrations found')
      this.exit()
    }

    this.spinner.start('DB migration')
    await migrator.up(options)
    this.spinner.stop()
  }

  async undo (migrator: Migration, migrations?: string[], options?: { to: string }): Promise<void> {
    if (!(await migrator.executed()).length) {
      this.log('No executed migrations found')
      this.exit()
    }

    this.spinner.start('Undo DB migration')
    await migrator.down(options)
    this.spinner.stop()
  }

  generateMigration (name: string): void {
    const migrationsFolder = path.resolve(__dirname, '../migrations')
    const scriptsFolder = path.resolve(__dirname, '../migrations/scripts')
    const fileName = `./${Date.now()}-${name}.ts`
    const filePath = path.resolve(scriptsFolder, fileName)

    if (!fs.existsSync(migrationsFolder)) {
      throw new Error('Migrations folder not found. Please run command from project root and make sure that you have \'migrations\' folder setup')
    }

    this.spinner.start(`Creating migration ${fileName}`)

    if (!fs.existsSync(scriptsFolder)) {
      fs.mkdirSync(scriptsFolder)
    }

    fs.writeFileSync(filePath, MigrationTemplate)
    this.spinner.stop()
  }

  async run (): Promise<void> {
    const { flags: originalFlags } = this.parse(DbCommand)
    const flags = originalFlags as OutputFlags<typeof DbCommand.flags>

    if (!flags.up && !flags.down && !flags.generate) throw new Error('One of \'--generate, --up, --down\'  required')

    if (!this.sequelize) {
      throw new Error('DB not instantiated!')
    }

    const migrator = new Migration(this.sequelize)

    if (flags.up) await this.migrate(migrator, flags.migration, flags)

    if (flags.down) await this.undo(migrator, flags.migration, flags)

    if (flags.generate) this.generateMigration(flags.generate)

    this.exit()
  }
}
