import Contract, { ContractOptions } from 'web3-eth-contract'
import { AbiItem } from 'web3-utils'
import config from 'config'

import { PinningManager } from '@rsksmart/rif-martketplace-storage-pinning/types/web3-v1-contracts/PinningManager'
import pinningContractAbi from '@rsksmart/rif-martketplace-storage-pinning/build/contracts/PinningManager.json'

let alreadySetup = false

export function setup (provider?: string): void {
  if (alreadySetup) {
    return
  }

  provider = provider || config.get('provider') || 'ws://localhost:8545'

  // @ts-ignore
  Contract.setProvider(provider)
  alreadySetup = true
}

export function getPinningContract (addr?: string, options?: ContractOptions): PinningManager {
  setup()

  if (!addr) {
    addr = config.get('pinningContractAddr')
  }

  if (!addr) {
    throw new Error('Contract without address')
  }

  return new Contract(pinningContractAbi.abi as AbiItem[], addr, options)
}
