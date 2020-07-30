/**
 * Basic logger interface used around the application.
 */
import type {
  AgreementFundsDeposited,
  AgreementFundsPayout,
  AgreementFundsWithdrawn,
  AgreementStopped,
  NewAgreement,
  TotalCapacitySet,
  MessageEmitted
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
  // What strategy for event listening should be used
  strategy?: Strategy

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

  marketplace?: {
    // Offer service path
    offer?: string

    // Agreement service path
    agreement?: string

    // Cache service url
    provider?: string
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

export type ErrorHandler = (fn: (...args: any[]) => Promise<void>, logger: Logger) => (...args: any[]) => Promise<void>

export interface AppOptions {
  dataDir: string
  db?: string
  removeCache?: boolean
  forcePrecache?: boolean
  errorHandler?: ErrorHandler
  contractAddress?: string
  strategy?: Strategy
}

export enum Strategy { Blockchain = 'blockchain', Marketplace = 'marketplace' }

/**
 * Interface for more complex handling of events.
 */
export interface EventsHandler<T extends StorageEvents, O extends EventProcessorOptions> {
  events: string[]
  process: (event: T, options: O) => Promise<void>
}
/**
 * Interface for object with event handler functions
 */
export type HandlersObject<T extends StorageEvents, O extends EventProcessorOptions> = { [key: string]: (event: T, options: O) => Promise<void> }

/**
 * Interfaces for Processor.
 */
export type Processor<T> = (event: T) => Promise<void>

export type BaseEventProcessorOptions = { manager?: ProviderManager }

export type BlockchainEventProcessorOptions = { eth: Eth } & BaseEventProcessorOptions

export type EventProcessorOptions = BaseEventProcessorOptions | BlockchainEventProcessorOptions

export type GetProcessorOptions = { errorHandler?: ErrorHandler, errorLogger?: Logger }

/**
 * Events interfaces.
 */
export interface MarketplaceEvent {
  event: string
  payload: Record<string, any>
}

export type BlockchainAgreementEvents = NewAgreement | AgreementStopped | AgreementFundsDeposited | AgreementFundsWithdrawn | AgreementFundsPayout

export type BlockchainOfferEvents = TotalCapacitySet | MessageEmitted

export type BlockchainEventsWithProvider = BlockchainOfferEvents | NewAgreement

export type BlockchainEvent = BlockchainOfferEvents | BlockchainAgreementEvents

export type StorageEvents = BlockchainEvent | MarketplaceEvent
