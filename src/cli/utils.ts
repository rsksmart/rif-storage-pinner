import config from 'config'
import path from 'path'

import Command, { flags } from '@oclif/command'
import { OutputFlags } from '@oclif/parser'
import cli, { IPromptOptions } from 'cli-ux'

import { Config } from '../definitions'
import { IOptionFlag } from '@oclif/command/lib/flags'

export const promptFlagIfNeeded = (flag: IOptionFlag<any>) => ({ ...flag, prompt: true, required: false }) as IOptionFlag<any>

export default abstract class BaseCommand extends Command {
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

  protected get spinner () {
    return cli.action
  }

  protected configSetup (flags: OutputFlags<typeof BaseCommand.flags>): void {
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
  }

  protected resolveDbPath (db: string) {
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

  protected async promptForRequiredFlags (flagsSchema: Record<any, any>, flags: Record<string, any>) {
    for (const [flagName, flagOption] of Object.entries(flagsSchema)) {
      if (flagOption.prompt && !flags[flagName]) {
        flags[flagName] = await this.prompt(`Please enter ${flagName}`)
      }
    }
    return flags
  }
}
