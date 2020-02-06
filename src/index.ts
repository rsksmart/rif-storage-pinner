import { setup, getPinningContract } from './contract'
import { waitForEnter } from './utils'
import config from 'config'

;(async function main (): Promise<void> {
  setup()
  const storageContract = await getPinningContract(undefined, {from: config.get('storageAccount')})
  const pinContract = await getPinningContract(undefined, {from: config.get('pinAccount')})

  pinContract.once('PriceSet', {}, (err: Error, data: object) => {
    if (err) {
      console.error(err)
    }

    console.log('Data: ', data)
  })

  storageContract.methods.increaseStorageCapacity(1000000).send()
  // storageContract.methods.setStorageOffer(1000000, 1000, [1, 2], [2, 1]).send()
  // storageContract.methods.setStoragePrice([1, 2], [2, 1]).send()
  // storageContract.methods.setMaximumDuration(100).send()
})().catch(e => console.error(e))

waitForEnter()
