import { Command } from '@oclif/command'
import fs from 'fs'
import path from 'path'

export default abstract class extends Command {
  private offerId: string | undefined
  private readonly providersFolders = ['.repos']

  protected isDataBaseExist (pathToFiles?: string, dbName?: string): boolean {
    return fs.existsSync(path.resolve(pathToFiles ?? this.config.dataDir, dbName ?? 'db.sqlite'))
  }

  protected isProviderFilesExist (pathToFiles?: string): boolean {
    return Boolean(this.providersFolders.find(folder => fs.existsSync(path.resolve(pathToFiles ?? this.config.dataDir, folder))))
  }
}
