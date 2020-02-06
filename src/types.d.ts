// TODO: Because of https://github.com/ethereum/web3.js/issues/3198
import { Contract } from 'web3-eth-contract'

declare module 'web3-eth-contract' {
  // @ts-ignore
  export default Contract
}
