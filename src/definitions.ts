/**
 * Basic logger interface used around the application.
 */
import {
  AgreementFundsDeposited, AgreementFundsPayout, AgreementFundsWithdrawn,
  AgreementStopped,
  NewAgreement
} from '@rsksmart/rif-marketplace-storage/types/web3-v1-contracts/StorageManager'
import type { Eth } from 'web3-eth'
import type { ClientOptions as IpfsOptions } from 'ipfs-http-client'

import type { ProviderManager } from './providers'

export enum Providers {
  IPFS = 'ipfs'
}

export interface Provider {
  pin (hash: string, expectedSize: number): Promise<void>
  unpin (hash: string): Promise<void>
}

/**
 * Basic logger interface used around the application.
 */
export interface Logger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  critical (message: string | Error | object, ...meta: any[]): never

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error (message: string | Error | object, ...meta: any[]): void

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn (message: string | object, ...meta: any[]): void

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info (message: string | object, ...meta: any[]): void

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verbose (message: string | object, ...meta: any[]): void

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug (message: string | object, ...meta: any[]): void
}

export interface NewBlockEmitterOptions {
  // If to use polling strategy, if false then listening is used.
  polling?: boolean

  // Interval in milliseconds, how often is blockchain checked.
  pollingInterval?: number
}

export interface EventsEmitterOptions {
  // If to use polling strategy, if false then listening is used.
  polling?: boolean

  // Interval in milliseconds, how often is blockchain checked.
  pollingInterval?: number

  // Starting block that upon first start of the service, will the blockchain be crawled for the past events.
  startingBlock?: string

  // Number of blocks that will be waited before passing an event for further processing.
  confirmations?: number
}

export interface Config {
  blockchain?: {
    // Address to where web3js should connect to. Should be WS endpoint.
    provider?: string

    // Address of deployed pinning contract
    contractAddress?: string

    // Events that will be listened to
    events?: string[]

    // Specify behavior of EventsEmitter, that retrieves events from blockchain and pass them onwards for further processing.
    eventsEmitter?: EventsEmitterOptions

    // Specify behavior of NewBlockEmitter, that detects new blocks on blockchain.
    newBlockEmitter?: NewBlockEmitterOptions
  }

  ipfs?: {
    clientOptions?: IpfsOptions
    sizeFetchTimeout?: number | string
  }

  log?: {
    level?: string
    filter?: string
    path?: string
  }
}

/**
 * Interface for more complex handling of events.
 */
export interface Handler {
  events: string[]
  process: (event: Event<any>, options?: ProcessorOptions) => Promise<void>
}

export type ErrorHandler = (fn: (...args: any[]) => Promise<void>, logger: Logger) => (...args: any[]) => Promise<void>

export interface AppOptions {
  dataDir?: string
  removeCache?: boolean
  forcePrecache?: boolean
  errorHandler?: ErrorHandler
  contractAddress?: string
}

export enum Strategy { Blockchain, Cache }

export type Processor = (event: Event<any>) => Promise<void>

export interface BlockchainEventsProcessorOptions {
  eth: Eth
  manager?: ProviderManager
}

export interface CacheEventsProcessorOptions {
  manager?: ProviderManager
}

export type ProcessorOptions = any | BlockchainEventsProcessorOptions | CacheEventsProcessorOptions

export interface CacheEvent {
  event: string
  payload: object
}

export type Event<T> = T & { event: string }

export type AgreementEvents = Event<NewAgreement & AgreementStopped & AgreementFundsDeposited & AgreementFundsWithdrawn & AgreementFundsPayout>
