import cli from 'cli-ux'
import { Command, flags } from '@oclif/command'
import { getStorageManagerContract } from '../../contract'
import { asciiToHex, soliditySha3 } from 'web3-utils'

export default class Withdraw extends Command {
  static description = 'Withdraw funds from existing Agreement'

  static examples = ['$ rif-pinning agreement:withdraw --offer 0x123 --withdraw 100 /ipfs/QmHash']

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
      description: 'address of offer that you want to be withdraw (env: RDS_AGREEMENT_OFFER)'
    }),

    withdraw: flags.integer({
      required: true,
      char: 't',
      description: 'how much should be withdrawn from the agreement'
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
    const { args, flags } = this.parse(Withdraw)
    this.validateAddress(flags.account, flags.offer)
    const fileHash = this.encodeHash(args.hash)

    const contract = getStorageManagerContract(undefined, { from: flags.account, gasPrice: '1000' })

    cli.action.start('Writing to blockchain')
    const gas = await contract.methods.withdrawFunds(fileHash, flags.offer, flags.withdraw).estimateGas()
    const hash = await contract.methods.withdrawFunds(fileHash, flags.offer, flags.withdraw).send({ gas })
    const id = soliditySha3(flags.account, ...fileHash)

    this.log(` ${flags.withdraw} withdrawn from Agreement ${id} with transaction: ${hash.transactionHash}`)
    cli.action.stop()
    this.exit()
  }
}
