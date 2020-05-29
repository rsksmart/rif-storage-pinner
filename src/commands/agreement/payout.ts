import cli from 'cli-ux'
import { Command, flags } from '@oclif/command'
import { getStorageManagerContract } from '../../contract'
import { asciiToHex, soliditySha3 } from 'web3-utils'

export default class Payout extends Command {
  static description = 'Payout funds from existing Agreement'

  static examples = ['$ rif-pinning agreement:payout --account 0x123 0x345']

  static flags = {
    account: flags.string({
      required: true,
      char: 'o',
      env: 'RDS_AGREEMENT_OFFER',
      description: 'address of account of the owner of the offer that you want to be payout (env: RDS_AGREEMENT_OFFER)'
    })
  }

  static args = [{ name: 'agreement', required: true }]

  private validateAddress (...addresses: string[]): void {
    for (const address of addresses) {
      if (!address.includes('x') || address.length !== 42) {
        this.error('Invalid address!')
      }
    }
  }

  async run (): Promise<void> {
    const { args, flags } = this.parse(Payout)
    this.validateAddress(flags.account, flags.account)

    const contract = getStorageManagerContract(undefined, { from: flags.account, gasPrice: '1000' })

    cli.action.start('Writing to blockchain')
    const gas = await contract.methods.payoutFunds([args.agreement]).estimateGas()
    const hash = await contract.methods.payoutFunds([args.agreement]).send({ gas })
    const id = soliditySha3(flags.account, ...args.agreement)

    this.log(` Agreement ${id} payed out with transaction: ${hash.transactionHash}`)
    cli.action.stop()
    this.exit()
  }
}
