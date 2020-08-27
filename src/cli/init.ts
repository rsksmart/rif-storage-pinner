import fs from 'fs'
import { flags } from '@oclif/command'
import { isAddress } from 'web3-utils'
import { IConfig } from '@oclif/config'
import config from 'config'
import { getObject, getEndPromise as forStoreFinish } from 'sequelize-store'

import BaseCommand, { promptForFlag } from '../utils'
import PeerId from 'peer-id'

const PEER_ID_PLACEHOLDER = '<<peerId>>'

export default class InitCommand extends BaseCommand {
  static flags = {
    ...BaseCommand.flags,
    offerId: promptForFlag(flags.string({
      char: 'o',
      description: 'ID of Offer to which should the service listen to'
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

  async run (): Promise<void> {
    const offerId = this.parsedArgs.flags.offerId

    if (!isAddress(offerId)) throw new Error('Invalid Offer Address')

    if (fs.existsSync(this.dbPath as string)) {
      if (!this.parsedArgs.flags.skipPrompt && !(await this.confirm('Are you sure you want to overwrite your current DB? All data will be erased! (y/n)'))) {
        this.exit()
      } else {
        fs.unlinkSync(this.dbPath as string)
      }
    }

    try {
      // Init DB
      this.spinner.start('Init DB')
      await this.initDB(this.dbPath as string, { migrate: true, skipPrompt: true })
      this.spinner.stop()

      // Store offerId
      this.spinner.start('Set Offer ID')
      this.offerId = offerId
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
      store.peerPrivKey = peerIdJson.privKey
      this.spinner.stop()

      const uiUrl = config.get<string>('uiUrl')
      this.log(`Create Offer here: ${uiUrl.replace(PEER_ID_PLACEHOLDER, peerId.toB58String())}`)
      this.log(`Or input your PeerId into the form: ${peerId.toB58String()}`)

      await forStoreFinish()
    } catch (e) {
      fs.unlinkSync(this.dbPath as string)
      throw e
    }
    this.exit()
  }
}
