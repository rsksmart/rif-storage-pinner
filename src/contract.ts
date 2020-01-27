import Contract, { ContractOptions } from 'web3-eth-contract'
import { promisify } from 'util'
import { readFile as readFileCb } from 'fs'
import { env } from 'process'


const readFile = promisify(readFileCb)

const PINNIG_CONTRACT_PATH = './contracts/PinningManager.json'

const PROVIDER_ENV = 'RDS_PROVIDER'
const CONTRACT_ADDR_ENV = 'RDS_CONTRACT_ADDR'

let alreadySetup = false

export function setup (provider?: string): void {
  if (alreadySetup) {
    return
  }

  provider = provider || env[PROVIDER_ENV] || 'ws://localhost:8545'

  // @ts-ignore
  Contract.setProvider(provider)
  alreadySetup = true
}

export async function getContract (addr?: string, options?: ContractOptions): Promise<Contract> {
  addr = addr || env[CONTRACT_ADDR_ENV]
  if(!addr){
    throw new Error('No contract address!')
  }

  const abiBuffer = await readFile(PINNIG_CONTRACT_PATH)
  const abi = JSON.parse(abiBuffer.toString()).abi

  return new Contract(abi, addr, Object.assign({gas: 100000}, options))
}
