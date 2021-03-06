import path from 'path'
import Umzug from 'umzug'

import { loggingFactory } from '../logger'
import { Sequelize } from 'sequelize'

const logger = loggingFactory('db:migration')

export class Migration {
  private umzugIns: Umzug.Umzug

  constructor (sequelize: Sequelize) {
    this.umzugIns = new Umzug({
      storage: 'sequelize',
      logging: logger.info,
      storageOptions: { sequelize },
      migrations: {
        path: path.resolve(__dirname, './scripts'),
        params: [sequelize.getQueryInterface(), sequelize],
        pattern: /^\d+[\w-]+\.(ts|js)$/
      }
    })
  }

  // eslint-disable-next-line require-await
  async up (options?: string | string[] | Umzug.UpToOptions | Umzug.UpDownMigrationsOptions): Promise<Umzug.Migration[]> {
    return this.umzugIns.up(options as any)
  }

  // eslint-disable-next-line require-await
  async down (options?: string | string[] | Umzug.DownToOptions | Umzug.UpDownMigrationsOptions): Promise<Umzug.Migration[]> {
    return this.umzugIns.down(options as any)
  }

  get on (): (eventName: ('migrating' | 'reverting' | 'migrated' | 'reverted'), cb?: (name: string, migration: Umzug.Migration) => void) => Umzug.Umzug {
    return this.umzugIns.on
  }

  // eslint-disable-next-line require-await
  async pending (): Promise<Umzug.Migration[]> {
    return this.umzugIns.pending().catch(e => {
      if (e.code === 'ENOENT') return []
      return Promise.reject(e)
    })
  }

  // eslint-disable-next-line require-await
  async executed (): Promise<Umzug.Migration[]> {
    return this.umzugIns.executed()
  }
}
