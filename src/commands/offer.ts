import cli from 'cli-ux'
import { Command, flags } from '@oclif/command'
import { getStorageManagerContract } from '../contract'

export default class Offer extends Command {
  static description = 'Manages Offers'

  static examples = ['$ rif-pinning offer --address 0x123 --price 100:10 --price 1000:80']

  static flags = {
    account: flags.string({
      required: true,
      char: 'a',
      env: 'RDS_STORAGE_ACCOUNT',
      description: 'address of account for which the Storage Offer will be created (env: RDS_STORAGE_ACCOUNT)'
    }),

    help: flags.help({ char: 'h' }),
    capacity: flags.integer({
      char: 'c',
      description: 'total capacity to be set for the offer'
    }),

    price: flags.string({
      multiple: true,
      char: 'p',
      description: 'set price for given interval; in format: <interval in seconds>:<price>'
    }),

    terminate: flags.boolean({
      char: 't',
      description: 'terminate the contract and prevents new requests or prolongation of current requests',
      exclusive: ['price', 'capacity']
    })
  }

  private validateAddress (address: string): void {
    if (!address.includes('x') || address.length !== 42) {
      this.error('Invalid address!')
    }
  }

  private parsePrices (pricesInput?: string[]): { prices?: number[], periods?: number[] } {
    if (!pricesInput) return { prices: undefined, periods: undefined }

    const prices: number[] = []
    const periods: number[] = []

    for (const price of pricesInput) {
      const splitted = price.split(':')

      if (splitted.length !== 2) {
        this.error('Invalid price!')
      }

      periods.push(parseInt(splitted[0]))
      prices.push(parseInt(splitted[1]))
    }

    return { prices, periods }
  }

  async run (): Promise<void> {
    const { flags } = this.parse(Offer)
    const { prices, periods } = this.parsePrices(flags.price)
    this.validateAddress(flags.account)
    const contract = getStorageManagerContract(undefined, { from: flags.account })

    if (flags.terminate) {
      const hash = await contract.methods.terminateOffer().send()
      this.log('Offer terminated with transaction: ', hash.transactionHash)
      this.exit()
    }

    if (!flags.price && !flags.capacity) {
      this._help()
    }

    cli.action.start('Writing to blockchain')

    if (flags.capacity) {
      const hash = await contract.methods.setTotalCapacity(flags.capacity).send()
      this.log('Total capacity set with transaction: ', hash.transactionHash)
    }

    if (prices && periods) {
      const hash = await contract.methods.setBillingPlans(periods, prices).send()
      this.log('Prices set with transaction: ', hash.transactionHash)
    }

    cli.action.stop()
    this.exit()
  }
}
