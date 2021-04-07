import fs from 'fs'
import { flags } from '@oclif/command'
import { isAddress } from 'web3-utils'
import { IConfig } from '@oclif/config'
import config from 'config'
import { getObject, getEndPromise as forStoreFinish } from 'sequelize-store'

import BaseCommand, { promptForFlag } from '../utils'
import PeerId from 'peer-id'
import { OutputFlags } from '@oclif/parser'
import path from "path"

const PEER_ID_PLACEHOLDER = '<<peerId>>'

export default class InitCommand extends BaseCommand {
  static flags = {
    ...BaseCommand.flags,
    network: flags.string({
      char: 'n',
      description: 'specifies to which network is the provider connected',
      options: ['testnet', 'mainnet'],
      env: 'RIFS_NETWORK'
    }),
    offerId: promptForFlag(flags.string({
      char: 'o',
      description: 'ID of Offer to which should the service listen to',
      env: 'RIFS_OFFER'
    })),
    keyType: flags.string({
      char: 't',
      options: ['rsa', 'ed25519', 'secp256k1'],
      default: 'rsa',
      description: 'Type of private key that will be used for Peer Identity'
    }),
    keySize: flags.integer({
      char: 's',
      default: 2048,
      description: 'Size of private key that will be used for Peer Identity'
    }),
    'override-db': flags.boolean({
      allowNo: true,
      description: 'Skip the prompt when database exists with used value --override-db/--no-override-db'
    })
  }

  static description = 'Initialize Pinner service dependencies'

  static examples = [
    '$ rif-pinning init',
    '$ rif-pinning init --offerId 0x123 --db ./relativeOrAbsolutePath/db.sqlite',
    '$ rif-pinning init --db fileName.sqlite',
    '$ rif-pinning init --db ./folder'
  ]

  constructor (argv: string[], config: IConfig) {
    super(argv, config, { serviceRequired: false, db: undefined })
  }

  protected baseConfig (flags: OutputFlags<typeof InitCommand.flags>): void {
    super.baseConfig(flags)
    const { userConfig, configObject } = this.configuration

    config.util.extendDeep(config, userConfig)
    config.util.extendDeep(config, configObject)

    if (flags.network) {
      const networkConfigPath = path.join(__dirname, '..', '..', 'config', `${flags.network}.json5`)
      config.util.extendDeep(config, config.util.parseFile(networkConfigPath))
    }
  }

  async run (): Promise<void> {
    const offerId = this.parsedArgs.flags.offerId

    if (!isAddress(offerId)) throw new Error('Invalid Offer Address')

    if (fs.existsSync(this.dbPath as string)) {
      const overrideDb = this.parsedArgs.flags['override-db']

      if (overrideDb === false) {
        this.exit()
      }

      if (overrideDb === true || this.parsedArgs.flags.skipPrompt === true || await this.confirm('Are you sure you want to overwrite your current DB? All data will be erased! (y/n)')) {
        fs.unlinkSync(this.dbPath as string)
      } else {
        this.exit()
      }
    }

    try {
      // Init DB
      this.spinner.start('Init DB')
      await this.initDB(this.dbPath as string, { migrate: true, skipPrompt: true })
      this.spinner.stop()

      // Store offerId
      this.spinner.start('Set Offer ID')
      this.offerId = offerId.toLowerCase()
      this.spinner.stop()

      // Peer identity
      this.spinner.start('Generating Peer Identity')
      const store = getObject()
      const peerId = (await PeerId.create({
        keyType: this.parsedArgs.flags.keyType,
        bits: this.parsedArgs.flags.keySize
      }))
      const peerIdJson = peerId.toJSON()

      store.peerId = peerIdJson.id
      store.peerPubKey = peerIdJson.pubKey as string
      store.peerPrivKey = peerIdJson.privKey as string
      this.spinner.stop()

      if (config.has('uiUrl')) {
        const uiUrl = config.get<string>('uiUrl')
        this.log(`Create Offer here: ${uiUrl.replace(PEER_ID_PLACEHOLDER, peerId.toB58String())}`)
        this.log(`Or input your PeerId into the form: ${peerId.toB58String()}`)
      } else {
        this.log(`Your PeerId: ${peerId.toB58String()}`)
      }

      await forStoreFinish()
    } catch (e) {
      try {
        fs.unlinkSync(this.dbPath as string)
      } catch (e) {
        if (e.code !== 'ENOENT') {
          throw e
        }
      }

      throw e
    }
    this.exit()
  }
}
