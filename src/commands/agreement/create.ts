import cli from 'cli-ux'
import { Command, flags } from '@oclif/command'
import { getStorageManagerContract } from '../../contract'
import { asciiToHex, soliditySha3 } from 'web3-utils'

export default class Agreement extends Command {
  static description = 'Create new Agreement'

  static examples = ['$ rif-pinning agreement:create --address 0x123 --offer 0x321 --size 200 --period 10 --']

  static flags = {
    account: flags.string({
      required: true,
      char: 'a',
      env: 'RDS_AGREEMENT_ACCOUNT',
      description: 'address of account from which the Agreement will be made (env: RDS_AGREEMENT_ACCOUNT)'
    }),

    offer: flags.string({
      required: true,
      char: 'o',
      env: 'RDS_AGREEMENT_OFFER',
      description: 'address of offer that will be accepted (env: RDS_AGREEMENT_OFFER)'
    }),

    size: flags.integer({
      required: true,
      char: 's',
      description: 'the size of pinned file'
    }),

    period: flags.integer({
      required: true,
      char: 'r',
      description: 'billing period to be used'
    }),

    totalPrice: flags.integer({
      required: true,
      char: 'p',
      description: 'how much should be prepaid to the contract'
    })
  }

  static args = [{ name: 'hash', required: true }]

  private validateAddress (...addresses: string[]): void {
    for (const address of addresses) {
      if (!address.includes('x') || address.length !== 42) {
        this.error('Invalid address!')
      }
    }
  }

  private encodeHash (hash: string): string[] {
    if (hash.length <= 32) {
      return [asciiToHex(hash)]
    }

    return [asciiToHex(hash.slice(0, 32)), ...this.encodeHash(hash.slice(32))]
  }

  async run (): Promise<void> {
    const { args, flags } = this.parse(Agreement)
    this.validateAddress(flags.account, flags.offer)
    const fileHash = this.encodeHash(args.hash)

    const contract = getStorageManagerContract(undefined, { from: flags.account, gasPrice: '1000' })

    cli.action.start('Writing to blockchain')
    const gas = await contract.methods.newAgreement(fileHash, flags.offer, flags.size, flags.period, []).estimateGas({ value: flags.totalPrice })
    const hash = await contract.methods.newAgreement(fileHash, flags.offer, flags.size, flags.period, []).send({ value: flags.totalPrice, gas })
    const id = soliditySha3(flags.account, ...fileHash)

    this.log(`New Agreement ${id} with transaction: ${hash.transactionHash}`)
    cli.action.stop()
    this.exit()
  }
}
