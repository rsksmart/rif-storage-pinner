import { hexToAscii } from 'web3-utils'
import config from 'config'
import path from 'path'
import cli, { ActionBase, IPromptOptions } from 'cli-ux'
import { IOptionFlag } from '@oclif/command/lib/flags'
import Command, { flags } from '@oclif/command'
import { OutputFlags } from '@oclif/parser'
import { getObject } from 'sequelize-store'

import type {
  BlockchainEvent,
  BlockchainEventsWithProvider,
  EventProcessorOptions,
  EventsHandler,
  Logger,
  StorageEvents,
  HandlersObject
} from './definitions'
import { Config } from './definitions'
import { loggingFactory } from './logger'

import { sequelizeFactory } from './sequelize'
import { initStore } from './store'

const logger = loggingFactory('utils')

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

export function duplicateObject<T> (obj: T): T {
  return JSON.parse(JSON.stringify(obj))
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
  private isDbInitialized = false
  static flags = {
    db: flags.string({
      char: 'd',
      description: 'Name or path to DB file',
      env: 'RIFS_DB',
      required: false
    }),
    config: flags.string({
      description: 'path to JSON config file to load',
      hidden: true,
      env: 'RIFS_CONFIG'
    }),
    log: flags.string({
      description: 'what level of information to log',
      options: ['error', 'warn', 'info', 'verbose', 'debug'],
      default: 'error',
      env: 'LOG_LEVEL'
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

  protected prompt (message: string, options: IPromptOptions = { required: true }): Promise<any> {
    return cli.prompt(message, options)
  }

  protected confirm (message: string): Promise<boolean> {
    return cli.confirm(message)
  }

  protected get spinner (): ActionBase {
    return cli.action
  }

  protected baseConfigSetup (flags: OutputFlags<typeof BaseCommand.flags>): Record<string, any> {
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

    config.util.extendDeep(config, userConfig)
    config.util.extendDeep(config, configObject)
    return { userConfig, configObject }
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

  protected async initDB (path: string, sync?: boolean): Promise<void> {
    const sequelize = await sequelizeFactory(path)

    if (sync) {
      await sequelize.sync()
    }
    await initStore(sequelize)
    this.isDbInitialized = true
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

  protected parseWithPrompt (command: any) {
    return this.promptForFlags(command.flags, this.parse(command))
  }
}
