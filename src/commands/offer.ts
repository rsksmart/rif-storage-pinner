import cli from 'cli-ux'
import { Command, flags } from '@oclif/command'
import { getPinningContract } from '../contract'

export default class Offer extends Command {
  static description = 'Manages StorageOffer'

  static examples = ['$ rif-pinning --address 0x123 --price 100:10 --price 1000:80']

  static flags = {
    account: flags.string({
      required: true,
      char: 'a',
      env: 'RDS_STORAGE_ACCOUNT',
      description: 'address of account for which the Storage Offer will be created (env: RDS_STORAGE_ACCOUNT)'
    }),

    help: flags.help({ char: 'h' }),
    capacity: flags.string({
      char: 'c',
      description: 'capacity to be added or removed from the offer; use +/-'
    }),

    maximumDuration: flags.integer({
      char: 'm',
      description: 'the maximum time (in seconds) for which a proposer can prepay'
    }),

    price: flags.string({
      multiple: true,
      char: 'p',
      description: 'set price for given interval; in format <interval in seconds>:<price>'
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

  async run () {
    const { args, flags } = this.parse(Offer)
    // @ts-ignore
    const { prices, periods } = this.parsePrices(flags.price)
    this.validateAddress(flags.account)

    if (!flags.price && !flags.maximumDuration && !flags.capacity) {
      this._help()
    }

    const contract = getPinningContract(undefined, { from: flags.account })
    cli.action.start('Writing to blockchain')

    if (flags.capacity) {
      if (flags.capacity.startsWith('+')) {
        const hash = await contract.methods.increaseStorageCapacity(parseInt(flags.capacity)).send()
        this.log('Capacity increased with transaction: ', hash.transactionHash)
      } else if (flags.capacity.startsWith('-')) {
        const hash = await contract.methods.decreaseStorageCapacity(Math.abs(parseInt(flags.capacity))).send()
        this.log('Capacity decreased with transaction: ', hash.transactionHash)
      } else {
        this.error('Capacity has to have either + or -')
      }
    }

    if (flags.maximumDuration) {
      const hash = await contract.methods.setMaximumDuration(flags.maximumDuration).send()
      this.log('Maximum duration set with transaction: ', hash.transactionHash)
    }

    if (prices && periods) {
      const hash = await contract.methods.setStoragePrice(periods, prices).send()
      this.log('Prices set with transaction: ', hash.transactionHash)
    }

    cli.action.stop()
    this.exit()
  }
}
