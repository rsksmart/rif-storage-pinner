import fs from 'fs'
import config from 'config'
import { flags } from '@oclif/command'
import { OutputFlags } from '@oclif/parser'

import BaseCommand, { duplicateObject } from '../utils'
import { IpfsProvider } from '../providers/ipfs'
import Agreement from '../models/agreement.model'
import { loggingFactory } from '../logger'

const logger = loggingFactory('CLEANUP')

export default class CleanupCommand extends BaseCommand {
  static flags = {
    ...BaseCommand.flags,
    unpin: flags.boolean({
      char: 'u',
      description: 'Unpin all files',
      default: false
    })
  }

  static description = 'Cleanup pinner files'

  static examples = [
    '$ rif-pinning cleanup',
    '$ rif-pinning cleanup --db myOffer.sqlite',
    '$ rif-pinning cleanup --unpin'
  ]

  purgeDb (path: string): Promise<void> {
    return fs.promises.unlink(path)
  }

  private getIpfsProvider () {
    return IpfsProvider.bootstrap(duplicateObject(config.get<string>('ipfs.clientOptions')), config.get<number|string>('ipfs.sizeFetchTimeout'))
  }

  private async unpinAgreements (db: string) {
    const provider = await this.getIpfsProvider()
    const dbPath = this.resolveDbPath(db)
    await this.initDB(dbPath, false)

    // Unpin agreements
    const agreements = await Agreement.findAll()
    for (const agreement of agreements) {
      await provider.unpin(agreement.dataReference)
        .catch(e => {
          // TODO Remove when pinning job done
          logger.warn(e)
        })
    }
  }

  async run (): Promise<void> {
    const { flags: originalFlags } = await this.parseWithPrompt(CleanupCommand)
    const flags = originalFlags as OutputFlags<typeof CleanupCommand.flags>
    this.baseConfigSetup(flags)
    const dbPath = this.resolveDbPath(flags.db)

    if (!fs.existsSync(dbPath)) {
      throw new Error('Service was not yet initialized, first run \'init\' command!')
    }

    if (flags.unpin) {
      this.spinner.start('Unpinning files...')
      await this.unpinAgreements(flags.db)
      this.spinner.stop()
    }

    this.spinner.start('Clean up db...')
    await this.purgeDb(dbPath)
    this.spinner.stop()

    this.exit()
  }
}
