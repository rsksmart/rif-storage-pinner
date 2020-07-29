import { getObject } from 'sequelize-store'

import Command from '../utils'
import { sequelizeFactory } from '../../sequelize'

function isValidAddress (address: string): boolean {
  return true
}

export class InitCommand extends Command {
  static description = 'Initialize Pinner service dependencies'
  static examples = [
    '$ rif-pinning <offerId>',
    '$ rif-pinning <offerId> --path ./folder'
  ]

  private async initProvider (path?: string): Promise<void> {
    if (this.isProviderFilesExist(path) && !prompt('Are you sure you want to overwrite current provider files?')) {
      throw new Error('Not allowed')
    }
    // run init.sh script
    return await Promise.resolve()
  }

  private async initDB (path?: string, options?: { dbName: string, force: boolean }): void {
    if (this.isDataBaseExist(path, options?.dbName) && !prompt(`Are you sure you want to overwrite current DB ${options?.dbName}?`)) {
      throw new Error('Not allowed')
    }
    // Init database connection
    const sequelize = await sequelizeFactory()
    this.log('Syncing database')
    await sequelize.sync({ force: options?.force })
  }

  private storeOfferId (offerId: string): void {
    const store = getObject()
    store.offerId = offerId
  }

  async run () {
    const command = this.parse(InitCommand)

    if (!isValidAddress(command.args.offerId)) throw new Error('Invalid Offer Address')

    // Init provider
    await this.initProvider()

    // Init DB
    await this.initDB()

    // Store offerId
    this.storeOfferId(command.args.offerId)
    this.log('Done')
    this.exit()
  }
}
