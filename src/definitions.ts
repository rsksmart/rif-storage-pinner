/**
 * Basic logger interface used around the application.
 */
import type { EventData } from 'web3-eth-contract'
import type { Eth } from 'web3-eth'
import type { ProviderManager } from './providers'

export enum Providers {
  IPFS = 'ipfs'
}

export interface Provider {
  pin(hash: string, expectedSize: number): Promise<void>
  unpin(hash: string): Promise<void>
}

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
    // URL to the IPFS running node
    connection?: string
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
  process: (event: EventData, eth: Eth, manager?: ProviderManager) => Promise<void>
}

export type ErrorHandler = (fn: (...args: any[]) => Promise<void>, logger: Logger) => (...args: any[]) => Promise<void>

export interface AppOptions {
  removeCache?: boolean
  forcePrecache?: boolean
  errorHandler?: ErrorHandler
  contractAddress?: string
}
