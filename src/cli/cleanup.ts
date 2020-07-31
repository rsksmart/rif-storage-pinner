import fs from 'fs'
import config from 'config'
import { flags } from '@oclif/command'
import { OutputFlags } from '@oclif/parser'

import BaseCommand, { duplicateObject } from '../utils'
import { IpfsProvider } from '../providers/ipfs'
import Agreement from '../models/agreement.model'
import { loggingFactory } from '../logger'
import { ProviderManager } from '../providers'

const logger = loggingFactory('cli:cleanup')

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

  private async getProviderManager (): Promise<ProviderManager> {
    const manager = new ProviderManager()
    manager.register(await IpfsProvider.bootstrap(duplicateObject(config.get<string>('ipfs.clientOptions')), config.get<number|string>('ipfs.sizeFetchTimeout')))
    return manager
  }

  private async unpinAgreements () {
    const provider = await this.getProviderManager()

    // Unpin agreements
    for (const agreement of await Agreement.findAll()) {
      await provider.unpin(agreement.dataReference)
        .catch(e => {
          logger.warn(e)
        })
    }
  }

  async run (): Promise<void> {
    await this.initCommand(CleanupCommand)
    const { flags: originalFlags } = this.parsedArgs
    const flags = originalFlags as OutputFlags<typeof CleanupCommand.flags>

    if (flags.unpin) {
      this.spinner.start('Unpinning files...')
      await this.unpinAgreements()
      this.spinner.stop()
    }

    this.spinner.start('Clean up db...')
    await this.purgeDb(this.dbPath as string)
    this.spinner.stop()

    this.exit()
  }
}
