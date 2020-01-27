import { setup, getContract } from './contract'
import { waitForEnter } from './utils'

const STORAGE_ACCOUNT = '0xa4e7163f7b173B4432bD051EAeFe17d42Fe0dfeb'
const PIN_ACCOUNT = '0x35D8e0b85B3253Fd5dAcF9B7d27BBFf412F3624e'

;(async function main (): Promise<void> {
  setup()
  const storageContract = await getContract(undefined, {from: STORAGE_ACCOUNT})
  const pinContract = await getContract(undefined, {from: PIN_ACCOUNT})

  pinContract.once('RequestMade', {}, (err: Error, data: object) => {
    if (err) {
      console.error(err)
    }

    console.log('Data: ', data)
  })

  storageContract.methods.setStorageOffer(1000000, 1000, [1, 2], [2, 1]).send()
})().catch(e => console.error(e))

waitForEnter()
