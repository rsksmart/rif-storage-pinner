import path from 'path'
import Umzug from 'umzug'

import { sequelizeFactory } from '../src/sequelize'

export class Migration {
  private umzugIns: Umzug.Umzug

  constructor (dbPath: string) {
    const sequelize = sequelizeFactory(dbPath)
    this.umzugIns = new Umzug({
      storage: 'sequelize',
      storageOptions: { sequelize },
      migrations: {
        path: path.resolve(__dirname, './scripts'),
        params: [sequelize.getQueryInterface()],
        pattern: /^\d+[\w-]+\.ts$/
      }
    })
  }

  // eslint-disable-next-line require-await
  async up (options?: string | string[] | Umzug.UpToOptions | Umzug.UpDownMigrationsOptions): Promise<Umzug.Migration[]> {
    return this.umzugIns.up(options as any)
  }

  // eslint-disable-next-line require-await
  async down (options?: string | string[] | Umzug.DownToOptions | Umzug.UpDownMigrationsOptions) {
    return this.umzugIns.down(options as any)
  }

  get on (): Function {
    return this.umzugIns.on
  }

  // eslint-disable-next-line require-await
  async pending (): Promise<Umzug.Migration[]> {
    return this.umzugIns.pending()
  }

  // eslint-disable-next-line require-await
  async executed (): Promise<Umzug.Migration[]> {
    return this.umzugIns.executed()
  }
}

export default class MigrationSingleton {
  private static ins: Migration | undefined

  static getInstance (path: string): Migration {
    if (!MigrationSingleton.ins) {
      MigrationSingleton.ins = new Migration(path)
    }

    return MigrationSingleton.ins
  }
}
