import cli from 'cli-ux'
import { Command, flags } from '@oclif/command'
import { getStorageManagerContract } from '../../contract'
import { asciiToHex, soliditySha3 } from 'web3-utils'

export default class Deposit extends Command {
  static description = 'Deposit funds to existing Agreement'

  static examples = ['$ rif-pinning agreement:deposit --offer 0x123 --deposit 100 /ipfs/QmHash']

  static flags = {
    account: flags.string({
      required: true,
      char: 'a',
      env: 'RDS_AGREEMENT_ACCOUNT',
      description: 'address of account from which the Agreement was made (env: RDS_AGREEMENT_ACCOUNT)'
    }),

    offer: flags.string({
      required: true,
      char: 'o',
      env: 'RDS_AGREEMENT_OFFER',
      description: 'address of offer that you want to be toppedup (env: RDS_AGREEMENT_OFFER)'
    }),

    deposit: flags.integer({
      required: true,
      char: 't',
      description: 'how much should be topped up to the contract'
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
    const { args, flags } = this.parse(Deposit)
    this.validateAddress(flags.account, flags.offer)
    const fileHash = this.encodeHash(args.hash)

    const contract = getStorageManagerContract(undefined, { from: flags.account, gasPrice: '1000' })

    cli.action.start('Writing to blockchain')
    const gas = await contract.methods.depositFunds(fileHash, flags.offer).estimateGas({ value: flags.deposit })
    const hash = await contract.methods.depositFunds(fileHash, flags.offer).send({ value: flags.deposit, gas })
    const id = soliditySha3(flags.account, ...fileHash)

    this.log(` Agreement ${id} topped up with ${flags.deposit} with transaction: ${hash.transactionHash}`)
    cli.action.stop()
    this.exit()
  }
}
