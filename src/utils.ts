import { Config, Logger } from './definitions'
import { Command, flags } from '@oclif/command'
import { Input, OutputFlags } from '@oclif/parser'
import { readFile } from 'fs/promises'
import config from 'config'

export function errorHandler (fn: (...args: any[]) => Promise<void>, logger: Logger): (...args: any[]) => Promise<void> {
  return (...args) => {
    return fn(...args).catch(err => logger.error(err))
  }
}

export abstract class BaseCLICommand extends Command {
  static flags = {
    config: flags.string({
      description: 'path to JSON config file to load',
      env: 'RIFM_CONFIG'
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

  async loadConfig (path?: string): Promise<Config> {
    if (!path) {
      return {}
    }

    const data = await readFile(path, 'utf-8')
    return JSON.parse(data) as Config
  }

  async init (): Promise<void> {
    const { flags: originalFlags } = this.parse(this.constructor as Input<typeof BaseCLICommand.flags>)
    const flags = originalFlags as OutputFlags<typeof BaseCLICommand.flags>

    const logObject = {
      log:
        {
          level: flags.log,
          filter: flags['log-filter'] || null,
          path: flags['log-path'] || null
        }
    }

    const userConfig = await this.loadConfig(flags.config)

    config.util.extendDeep(config, userConfig)
    config.util.extendDeep(config, logObject)

    return Promise.resolve()
  }
}
