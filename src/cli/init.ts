import fs from 'fs'
import { flags } from '@oclif/command'
import { isAddress } from 'web3-utils'
import { IConfig } from '@oclif/config'

import BaseCommand, { promptForFlag } from '../utils'

export default class InitCommand extends BaseCommand {
  static flags = {
    ...BaseCommand.flags,
    offerId: promptForFlag(flags.string({
      char: 'o',
      description: 'ID of Offer to which should the service listen to'
    }))
  }

  static description = 'Initialize Pinner service dependencies'

  static examples = [
    '$ rif-pinning init',
    '$ rif-pinning init --offerId 0x123 --db ./relativeOrAbsolutePath/db.sqlite',
    '$ rif-pinning init --db fileName.sqlite',
    '$ rif-pinning init --db ./folder'
  ]

  constructor (argv: string[], config: IConfig) {
    super(argv, config, { serviceRequired: false, db: undefined })
  }

  async run (): Promise<void> {
    const offerId = this.parsedArgs.flags.offerId

    if (!isAddress(offerId)) throw new Error('Invalid Offer Address')

    if (fs.existsSync(this.dbPath as string)) {
      if (!(await this.confirm('Are you sure you want to overwrite your current DB? (y/n)'))) {
        this.exit()
      }
    }

    try {
      // Init DB
      this.spinner.start('Init DB')
      await this.initDB(this.dbPath as string, { sync: true, migrate: true, forcePrompt: true })
      this.spinner.stop()

      // Store offerId
      this.spinner.start('Set Offer ID')
      this.offerId = offerId
      this.spinner.stop()
    } catch (e) {
      fs.unlinkSync(this.dbPath as string)
      throw e
    }
    this.exit()
  }
}
