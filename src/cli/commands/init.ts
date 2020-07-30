import fs from 'fs'
import { getObject } from 'sequelize-store'
import { flags } from '@oclif/command'
import { OutputFlags } from '@oclif/parser'
import { isAddress } from 'web3-utils'

import BaseCommand, { promptFlagIfNeeded } from '../utils'
import { sequelizeFactory } from '../../sequelize'
import { initStore } from '../../store'

export default class InitCommand extends BaseCommand {
  static flags = {
    ...BaseCommand.flags,
    offerId: promptFlagIfNeeded(flags.string({
      char: 'o',
      description: 'ID of Offer to which should the service listen to',
      env: 'RIFS_OFFER'
    }))
  }

  static get description (): string {
    return 'Initialize Pinner service dependencies'
  }

  static examples = [
    '$ rif-pinning init',
    '$ rif-pinning init --offerId 0x123 --db ./relativeOrAbsolutePath/db.sqlite',
    '$ rif-pinning init --db fileName.sqlite',
    '$ rif-pinning init --db ./folder'
  ]

  private async initDB (path: string): Promise<void> {
    if (fs.existsSync(path)) {
      throw new Error('Already initialized. Please run "cleanup" for removing current pinner service files')
    }
    // Init database connection
    const sequelize = await sequelizeFactory(path)
    await sequelize.sync()
    await initStore(sequelize)
  }

  private storeOfferId (offerId: string): void {
    const store = getObject()
    store.offerId = offerId
  }

  async run (): Promise<void> {
    const { flags: originalFlags } = await this.promptForRequiredFlags(InitCommand.flags, this.parse(InitCommand))
    const flags = originalFlags as OutputFlags<typeof InitCommand.flags>

    this.configSetup(flags)
    const dbPath = this.resolveDbPath(flags.db)

    if (!isAddress(flags.offerId)) throw new Error('Invalid Offer Address')

    // Init DB
    await this.initDB(dbPath)

    // Store offerId
    this.storeOfferId(flags.offerId)

    this.exit()
  }
}
