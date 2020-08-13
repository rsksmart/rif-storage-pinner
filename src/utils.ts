import { hexToAscii } from 'web3-utils'
import fs from 'fs'
import BigNumber from 'bignumber.js'
import config from 'config'
import path from 'path'
import cli, { ActionBase, IPromptOptions } from 'cli-ux'
import { IOptionFlag } from '@oclif/command/lib/flags'
import { IConfig } from '@oclif/config'
import Command, { flags } from '@oclif/command'
import { OutputFlags } from '@oclif/parser'
import { getObject } from 'sequelize-store'
import type { EventEmitter } from 'events'

import DbMigration from '../migrations/index'
import type {
  BlockchainEvent,
  BlockchainEventsWithProvider,
  Config,
  EventProcessorOptions,
  EventsHandler,
  Logger,
  StorageEvents,
  HandlersObject,
  InitCommandOption
} from './definitions'

import { sequelizeFactory } from './sequelize'
import { initStore } from './store'
import { ProviderManager } from './providers'
import { CliInitDbOptions, JobManagerOptions } from './definitions'
import { JobsManager } from './jobs-manager'
import { IpfsProvider } from './providers/ipfs'

export function bnFloor (v: string | number | BigNumber): BigNumber {
  return new BigNumber(v).integerValue(BigNumber.ROUND_FLOOR)
}

export function errorHandler (fn: (...args: any[]) => Promise<void>, logger: Logger): (...args: any[]) => Promise<void> {
  return (...args) => {
    return fn(...args).catch(err => logger.error(err))
  }
}

export function isEventWithProvider (event: BlockchainEvent): event is BlockchainEventsWithProvider {
  return Boolean((event as BlockchainEventsWithProvider).returnValues.provider)
}

export function isValidEvent (value: string, handlers: object): value is keyof typeof handlers {
  return value in handlers
}

export function buildHandler<T extends StorageEvents, O extends EventProcessorOptions> (handlers: HandlersObject<T, O>, events: string[]): EventsHandler<T, O> {
  return {
    events,
    process: (event: T, options: O): Promise<void> => {
      if (!isValidEvent(event.event, handlers)) {
        return Promise.reject(new Error(`Unknown event ${event.event}`))
      }

      return handlers[event.event](event, options ?? {} as O)
    }
  }
}

/**
 * Utility function for decoding Solidity's byte32 array.
 * @param fileReference
 */
export function decodeByteArray (fileReference: string[]): string {
  return fileReference
    .map(hexToAscii)
    .join('')
    .trim()
    .replace(/\0/g, '') // Remove null-characters
}

/**
 * Duplicate object using JSON method. Functions are stripped.
 * @param obj
 */
export function duplicateObject<T> (obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Create a Promise that is resolved when the specified event is emitted.
 * It is rejected if 'error' event is triggered.
 *
 * Be aware about the different mechanisms of EventEmitter and Promises!
 * Promise can be only ONCE fulfilled/rejected while EventEmitter can emit as many events
 * as it likes! Hence this utility resolves only upon first specified event or error.
 *
 * @param emitted
 * @param event
 */
export function runAndAwaitFirstEvent<T = void> (emitted: EventEmitter, event: string, fn: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    emitted.on(event, resolve)
    emitted.on('error', reject)
    fn()
  })
}

export function sleep<T> (ms: number, ...args: T[]): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(...args), ms))
}

/**
 * Prompt for flag if not provided wrapper
 * @param {IOptionFlag<any>} flag Oclif flag object
 * @return IOptionFlag<any> & { prompt: string | boolean }
 */
export function promptForFlag (flag: IOptionFlag<any>): IOptionFlag<any> {
  return { ...flag, prompt: true, required: false } as IOptionFlag<any> & { prompt: boolean | string }
}

/**
 * Base class for Pinner service commands
 * It have predefined some basic flags and config processing
 * Also have some helpers for initializing DB, storing Offer ID and some ui (spinner, prompt for flag)
 * @abstract
 * @class BaseCommand
 */
export default abstract class BaseCommand extends Command {
  protected initOptions: InitCommandOption
  protected defaultInitOptions: InitCommandOption = { baseConfig: true, db: { sync: false, migrate: false }, serviceRequired: true }
  protected configuration: Record<string, any> = {}
  protected parsedArgs: any
  protected dbPath: string | undefined
  protected isDbInitialized = false
  static flags = {
    db: flags.string({
      char: 'd',
      description: 'Name or path to DB file',
      env: 'RIFS_DB',
      required: false
    }),
    config: flags.string({
      description: 'path to JSON config file to load',
      env: 'RIFS_CONFIG'
    }),
    log: flags.string({
      description: 'what level of information to log',
      options: ['error', 'warn', 'info', 'verbose', 'debug'],
      default: 'error',
      env: 'LOG_LEVEL'
    }),
    skipPrompt: flags.boolean({
      description: 'Answer yes for any prompting',
      default: false
    }),
    'log-filter': flags.string(
      {
        description: 'what components should be logged (+-, chars allowed)'
      }
    ),
    'log-path': flags.string(
      {
        description: 'log to file, default is STDOUT'
      }
    )
  }

  constructor (argv: string[], config: IConfig, options: InitCommandOption = {}) {
    super(argv, config)
    this.initOptions = { ...this.defaultInitOptions, ...options }
  }

  protected prompt (message: string, options: IPromptOptions = { required: true }): Promise<any> {
    return cli.prompt(message, options)
  }

  protected confirm (message: string): Promise<boolean> {
    return cli.confirm(message)
  }

  protected get spinner (): ActionBase {
    return cli.action
  }

  protected set offerId (offerId: string) {
    const store = getObject()
    store.offerId = offerId
  }

  protected get offerId (): string {
    if (!this.isDbInitialized) throw new Error('DB is not initialized')
    const store = getObject()

    if (!store.offerId) throw new Error('Offer Id is not found in DB')

    return getObject().offerId as string
  }

  protected async getProviderManager (): Promise<ProviderManager> {
    const jobsOptions = config.get<JobManagerOptions>('jobs')
    const jobsManager = new JobsManager(jobsOptions)

    const manager = new ProviderManager()
    manager.register(await IpfsProvider.bootstrap(jobsManager, duplicateObject(config.get<string>('ipfs.clientOptions'))))
    return manager
  }

  protected baseConfig (flags: OutputFlags<typeof BaseCommand.flags>): void {
    const configObject: Config = {
      log: {
        level: flags.log,
        filter: flags['log-filter'] || null,
        path: flags['log-path'] || null
      }
    }

    let userConfig: Config = {}

    if (flags.config) {
      userConfig = config.util.parseFile(flags.config)
    }
    config.util.extendDeep(config, configObject)
    config.util.extendDeep(config, userConfig)

    this.configuration = { userConfig, configObject }
  }

  protected resolveDbPath (db: string): string {
    if (!db) return path.resolve(this.config.dataDir, config.get<string>('db'))

    const parsed = path.parse(db)

    // File name
    if (!parsed.dir) {
      return path.resolve(
        this.config.dataDir,
        parsed.ext
          ? db
          : `${parsed.base}.sqlite`
      )
    } else {
      if (db[db.length - 1] === '/') throw new Error('Path should include the file name')
      return path.resolve(`${db}${parsed.ext ? '' : '.sqlite'}`)
    }
  }

  protected async promptForFlags (flagsSchema: Record<any, any> = {}, parsed: Record<string, any>): Promise<Record<string, any>> {
    for (const [flagName, flagOption] of Object.entries(flagsSchema)) {
      // TODO extend to support prompt for boolean, options
      if (flagOption.prompt && !parsed.flags[flagName]) {
        parsed.flags[flagName] = await this.prompt(typeof flagOption.prompt === 'string'
          ? flagOption.prompt
          : `Please enter ${flagName}`
        )
      }
    }
    return parsed
  }

  protected async initDB (path: string, options?: CliInitDbOptions & { skipPrompt?: boolean }): Promise<void> {
    const sequelize = await sequelizeFactory(path)
    const migrator = DbMigration.getInstance(sequelize)

    if (options?.sync) {
      await sequelize.sync({ force: true })
    }

    // Init store
    await initStore(sequelize)

    // Run migration
    if (options?.migrate) {
      if ((await migrator.pending()).length) {
        if (options?.skipPrompt || await this.prompt('DB Migration required! Run Migration (y/n)?')) {
          await migrator.up()
        } else {
          this.exit()
        }
      }
    }

    this.isDbInitialized = true
  }

  protected parseWithPrompt (command: any): Promise<Record<string, any>> {
    return this.promptForFlags(command.flags, this.parse(command))
  }

  protected async init (): Promise<void> {
    const { db, baseConfig, serviceRequired } = this.initOptions
    this.parsedArgs = await this.parseWithPrompt(this.constructor)

    if (baseConfig) this.baseConfig(this.parsedArgs.flags)
    this.dbPath = this.resolveDbPath(this.parsedArgs.flags.db)

    if (serviceRequired && !fs.existsSync(this.dbPath as string)) {
      throw new Error('Service was not yet initialized, first run \'init\' command!')
    }

    if (db) {
      await this.initDB(this.dbPath, { ...db, skipPrompt: Boolean(this.parsedArgs.flags.skipPrompt) })
    }
  }
}
