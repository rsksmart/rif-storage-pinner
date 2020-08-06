import { flags } from '@oclif/command'
import type { OutputFlags } from '@oclif/parser'
import config from 'config'
import path from 'path'

import BaseCommand from '../utils'
import initApp from '../index'
import { Strategy } from '../definitions'
import { IConfig } from '@oclif/config'

export default class PinningServiceCommand extends BaseCommand {
  static description = 'Run pinning service'

  static examples = [
    '$ rif-pinning daemon --strategy=blockchain --provider \'ws://localhost:8546\' --ipfs \'/ip4/127.0.0.1/tcp/5001\' --network testnet',
    '',
    '$ rif-pinning daemon --strategy=marketplace --ipfs \'/ip4/127.0.0.1/tcp/5001\' --network testnet'
  ]

  static flags = {
    ...BaseCommand.flags,
    network: flags.string({
      char: 'n',
      description: 'specifies to which network is the provider connected',
      options: ['testnet', 'mainnet'],
      env: 'RIFS_NETWORK'
    }),
    provider: flags.string({
      char: 'p',
      description: 'URL to blockchain node or Marketplace server',
      env: 'RIFS_PROVIDER'
    }),
    strategy: flags.string({
      description: 'what type of provider will be used for listening on events. Default is "marketplace". For blockchain you have to have access to a node that has allowed eth_getLogs call.',
      options: ['marketplace', 'blockchain']
    }),
    ipfs: flags.string({
      description: 'specifies a connection URL to IPFS node. Default is go-ipfs listening configuration.',
      env: 'RIFS_IPFS'
    })
  }

  constructor (argv: string[], config: IConfig) {
    super(argv, config, { db: { sync: false, migrate: true } })
  }

  protected baseConfig (flags: OutputFlags<typeof PinningServiceCommand.flags>): void {
    super.baseConfig(flags)
    const { userConfig, configObject } = this.configuration

    if (flags.strategy) {
      configObject.strategy = flags.strategy
    }

    if (flags.provider) {
      // We have to use hardcoded 'Strategy.Marketplace' here as default value, because we cant touch the `config` object yet.
      const strategy = userConfig.strategy ?? configObject.strategy ?? Strategy.Marketplace

      if (strategy === Strategy.Blockchain) {
        configObject.blockchain = { provider: flags.provider }
      } else {
        configObject.marketplace = { provider: flags.provider }
      }
    }

    if (flags.ipfs) {
      configObject.ipfs = { clientOptions: { url: flags.ipfs } }
    }

    config.util.extendDeep(config, userConfig)
    config.util.extendDeep(config, configObject)

    if (flags.network) {
      const networkConfigPath = path.join(__dirname, '..', '..', 'config', `${flags.network}.json5`)
      config.util.extendDeep(config, config.util.parseFile(networkConfigPath))
    }

    if (!config.has('blockchain.contractAddress')) {
      throw new Error('You have to specify address of smart contract! Use --network flag!')
    }
  }

  async run (): Promise<void> {
    const offerId = this.offerId

    // Run app
    await initApp(offerId)
  }
}
