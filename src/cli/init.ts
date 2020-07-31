import fs from 'fs'
import { flags } from '@oclif/command'
import { OutputFlags } from '@oclif/parser'
import { isAddress } from 'web3-utils'

import BaseCommand, { promptForFlag } from '../utils'

export default class InitCommand extends BaseCommand {
  static flags = {
    ...BaseCommand.flags,
    offerId: promptForFlag(flags.string({
      char: 'o',
      description: 'ID of Offer to which should the service listen to'
    })),
    force: flags.boolean({
      default: false,
      char: 'f',
      description: 'Overwrite DB if exist'
    })
  }

  static description = 'Initialize Pinner service dependencies'

  static examples = [
    '$ rif-pinning init',
    '$ rif-pinning init --offerId 0x123 --db ./relativeOrAbsolutePath/db.sqlite',
    '$ rif-pinning init --db fileName.sqlite',
    '$ rif-pinning init --db ./folder'
  ]

  async run (): Promise<void> {
    const { flags: originalFlags } = await this.parseWithPrompt(InitCommand)
    const flags = originalFlags as OutputFlags<typeof InitCommand.flags>

    this.baseConfigSetup(flags)
    const dbPath = this.resolveDbPath(flags.db)

    if (!isAddress(flags.offerId)) throw new Error('Invalid Offer Address')

    if (fs.existsSync(dbPath)) {
      if (flags.force && !(await this.confirm('Are you sure you want to overwrite your current DB? (y/n)'))) {
        this.exit()
      } else {
        throw new Error('Already initialized. Please run "cleanup" for removing current pinner service files')
      }
    }

    try {
      // Init DB
      this.spinner.start('Init DB')
      await this.initDB(dbPath, true)
      this.spinner.stop()

      // Store offerId
      this.spinner.start('Set Offer ID')
      this.offerId = flags.offerId
      this.spinner.stop()
    } catch (e) {
      fs.unlinkSync(dbPath)
      throw e
    }
    this.exit()
  }
}
