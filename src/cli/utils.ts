import { Command } from '@oclif/command'
import fs from 'fs'
import path from 'path'

export abstract class BaseCommand extends Command {
  private offerId: string | undefined
  private readonly providersFolders = ['.repos']

  protected constructor (argv: any, config: any, offerId: string) {
    super(argv, config)
    this.offerId = offerId
  }

  private isDataBaseExist (dbName?: string): boolean {
    return fs.existsSync(path.resolve(this.config.dataDir, dbName ?? 'db.sqlite'))
  }

  private isProviderFilesExist (): boolean {
    return Boolean(this.providersFolders.find(folder => fs.existsSync(path.resolve(this.config.dataDir, folder))))
  }
}
