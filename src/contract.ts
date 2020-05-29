import Contract, { ContractOptions } from 'web3-eth-contract'
import config from 'config'

import { StorageManager } from '@rsksmart/rif-marketplace-storage/types/web3-v1-contracts/StorageManager'
import storageManagerContractAbi from '@rsksmart/rif-marketplace-storage/build/contracts/StorageManager.json'

let alreadySetup = false

export function setup (provider?: string): void {
  if (alreadySetup) {
    return
  }

  provider = provider || config.get('provider')

  // @ts-ignore
  Contract.setProvider(provider)
  alreadySetup = true
}

export function getStorageManagerContract (addr?: string, options?: ContractOptions): StorageManager {
  setup()

  if (!addr) {
    addr = config.get<string>('storageManagerContractAddr')
  }

  if (!addr) {
    throw new Error('Contract without address')
  }

  // @ts-ignore
  return (new Contract(storageManagerContractAbi.abi, addr, options)) as StorageManager
}
