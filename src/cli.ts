import initApp from './'

import { Command, flags } from '@oclif/command'
import type { Input, OutputFlags } from '@oclif/parser'
import config from 'config'
import path from 'path'

import { Config } from './definitions'

export default class PinningServiceCommand extends Command {
  static flags = {
    offerId: flags.string({
      char: 'o',
      description: 'ID of Offer to which should the service listen to',
      env: 'RIFS_OFFER',
      required: true
    }),
    network: flags.string({
      char: 'n',
      description: 'specifies to which network is the provider connected',
      options: ['testnet', 'mainnet'],
      env: 'RIFS_NETWORK'
    }),
    provider: flags.string({
      char: 'p',
      description: 'URL to blockchain node provider',
      env: 'RIFS_PROVIDER'
    }),
    'remove-cache': flags.boolean({
      description: 'removes the local database'
    }),
    config: flags.string({
      description: 'path to JSON config file to load',
      hidden: true,
      env: 'RIFS_CONFIG'
    }),
    ipfs: flags.string({
      description: 'specifies a connection URL to IPFS node. Default is go-ipfs listening configuration.',
      env: 'RIFS_IPFS'
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

  private configSetup (flags: OutputFlags<typeof PinningServiceCommand.flags>): void {
    const configObject: Config = {
      log: {
        level: flags.log,
        filter: flags['log-filter'] || null,
        path: flags['log-path'] || null
      }
    }

    if (flags.provider) {
      configObject.blockchain = { provider: flags.provider }
    }

    if (flags.ipfs) {
      configObject.ipfs = { connection: flags.ipfs }
    }

    if (flags.config) {
      config.util.extendDeep(config, config.util.parseFile(flags.config))
    }

    config.util.extendDeep(config, configObject)

    if (flags.network) {
      const networkConfigPath = path.join(__dirname, '..', 'config', `${flags.network}.json5`)
      config.util.extendDeep(config, config.util.parseFile(networkConfigPath))
    }

    if (!config.has('blockchain.contractAddress')) {
      throw new Error('You have to specify address of smart contract! Use --network flag!')
    }
  }

  async run () {
    const { flags: originalFlags } = this.parse(this.constructor as Input<typeof PinningServiceCommand.flags>)
    const flags = originalFlags as OutputFlags<typeof PinningServiceCommand.flags>
    this.configSetup(flags)

    await initApp(flags.offerId, { removeCache: Boolean(flags['remove-cache']) })
  }
}
