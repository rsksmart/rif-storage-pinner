import { flags } from '@oclif/command'
import type { OutputFlags } from '@oclif/parser'
import fs from 'fs'
import config from 'config'
import path from 'path'

import BaseCommand from '../utils'
import initApp from '../index'
import { Strategy } from '../definitions'

export default class PinningServiceCommand extends BaseCommand {
  static description = `
Pinning Service that is part of RIF Storage.

This service is needed to provide your storage space as part of RIF Marketplace. It listens on events and when there is new Agreement for specified Offer it will pin the content to your configured IPFS node.

By default it uses RIF Marketplace servers to listen on events, which are based on events from blockchain. You can eliminate this middle-man component and listen to events directly from blockchain. For that use --strategy=blockchain, but you have to also provide an blockchain node that has enabled eth_getLogs call using the --provider flag.
`

  static examples = [
    '$ rif-pinning --offerId 0x123456789 --strategy=blockchain --provider \'ws://localhost:8546\' --ipfs \'/ip4/127.0.0.1/tcp/5001\' --network testnet',
    '',
    '$ rif-pinning --offerId 0x123456789 --strategy=marketplace --ipfs \'/ip4/127.0.0.1/tcp/5001\' --network testnet'
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
    'remove-cache': flags.boolean({
      description: 'removes the local database prior running the service'
    }),
    ipfs: flags.string({
      description: 'specifies a connection URL to IPFS node. Default is go-ipfs listening configuration.',
      env: 'RIFS_IPFS'
    })
  }

  protected configSetup (flags: OutputFlags<typeof PinningServiceCommand.flags>): void {
    const { userConfig, configObject } = super.baseConfigSetup(flags)

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
    const { flags: originalFlags } = await this.parseWithPrompt(PinningServiceCommand)
    const flags = originalFlags as OutputFlags<typeof PinningServiceCommand.flags>
    this.configSetup(flags)

    const dbPath = this.resolveDbPath(flags.db)

    if (!fs.existsSync(dbPath)) {
      throw new Error('Service was not yet initialized, first run \'init\' command!')
    }

    await this.initDB(dbPath, false)
    const offerId = this.offerId

    // Run app
    await initApp(offerId, { removeCache: Boolean(flags['remove-cache']), db: dbPath, dataDir: this.config.dataDir })
  }
}
