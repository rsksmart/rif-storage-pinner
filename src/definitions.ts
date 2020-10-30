/**
 * Basic logger interface used around the application.
 */
import type { BigNumber } from 'bignumber.js'

import type { Eth } from 'web3-eth'
import type { ClientOptions as IpfsOptions } from 'ipfs-http-client'
import type { Options as Libp2pOptions } from 'libp2p'

import type { ProviderManager } from './providers'

import * as storageEvents from '@rsksmart/rif-marketplace-storage/types/web3-v1-contracts/StorageManager'
import * as stakingEvents from '@rsksmart/rif-marketplace-storage/types/web3-v1-contracts/Staking'

export enum Providers {
  IPFS = 'ipfs'
}

export interface Provider {
  pin (hash: string, expectedSize: BigNumber, peerId?: string): Promise<void>
  unpin (hash: string): void
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
  // URL to the UI that should be passed PeerId upon initialization. Use <<peerId>> as placeholder that will
  // get replaced with the actual PeerId.
  uiUrl?: string

  comms?: {
    libp2p?: Libp2pOptions
    countOfMessagesPersistedPerAgreement?: number
  }

  directAddress?: {
    ttl?: string
  }

  // What strategy for event listening should be used
  strategy?: Strategy

  blockchain?: {
    // Address to where web3js should connect to. Should be WS endpoint.
    provider?: string

    // Address of deployed pinning contract
    contractAddress?: string

    // Events that will be listened to
    events?: string[]

    // Topics that will be listened to, if specified than has priority over "events" configuration
    topics?: string[]

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

    // Reorg service path
    reorg?: string

    // Cache service url
    provider?: string
  }

  ipfs?: {
    clientOptions?: IpfsOptions
    sizeFetchTimeout?: number | string
  }

  jobs?: JobManagerOptions

  log?: {
    level?: string
    filter?: string
    path?: string
  }
}

export enum JobState {
  RUNNING = 'running',
  BACKOFF = 'backoff',
  CREATED = 'created',
  ERRORED = 'errored',
  FINISHED = 'finished'
}

export interface JobManagerOptions {
  retries?: number
  backoffTime?: number
  exponentialBackoff?: boolean
}

export type ErrorHandler = (fn: (...args: any[]) => Promise<void>, logger: Logger) => (...args: any[]) => Promise<void>

export interface AppOptions {
  appResetCallback: () => void
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

export type BlockchainAgreementEvents = storageEvents.AgreementFundsDeposited
  | storageEvents.AgreementFundsPayout
  | storageEvents.AgreementFundsWithdrawn
  | storageEvents.AgreementStopped

export type BlockchainAgreementEventsWithNewAgreement = BlockchainAgreementEvents | storageEvents.NewAgreement

export type BlockchainOfferEvents = storageEvents.BillingPlanSet
  | storageEvents.MessageEmitted
  | storageEvents.TotalCapacitySet

export type BlockchainStakeEvents = stakingEvents.Staked | stakingEvents.Unstaked
export type BlockchainEventsWithProvider = BlockchainOfferEvents | storageEvents.NewAgreement
export type BlockchainEvent = BlockchainOfferEvents | BlockchainAgreementEventsWithNewAgreement | BlockchainStakeEvents

export type StorageEvents = BlockchainEvent | MarketplaceEvent

/****************************************************************************************
 * CLI
 */
export interface InitCommandOption {
  db?: CliInitDbOptions
  baseConfig?: boolean
  serviceRequired?: boolean
}

export type CliInitDbOptions = { migrate?: boolean }

/****************************************************************************************
 * Communications
 */

export enum MessageCodesEnum {
  I_GENERAL = 'I_GEN',
  I_AGREEMENT_NEW = 'I_AGR_NEW',
  I_AGREEMENT_STOPPED = 'I_AGR_STOP',
  I_AGREEMENT_EXPIRED = 'I_AGR_EXP',
  I_HASH_START = 'I_HASH_START',
  I_HASH_PINNED = 'I_HASH_STOP',
  I_MULTIADDR_ANNOUNCEMENT = 'I_ADDR_ANNOUNCE',
  I_RESEND_LATEST_MESSAGES = 'I_RESEND',
  W_GENERAL = 'W_GEN',
  W_HASH_RETRY = 'W_HASH_RETRY',
  E_GENERAL = 'E_GEN',
  E_HASH_NOT_FOUND = 'E_HASH_404',
  E_AGREEMENT_SIZE_LIMIT_EXCEEDED = 'E_AGR_SIZE_OVERFLOW'
}

// Outgoing messages

interface BasePayload {
  agreementReference: string
}

export interface RetryPayload extends BasePayload {
  error: string
  retryNumber: number
  totalRetries: number
}

export interface HashInfoPayload extends BasePayload {
  hash: string
}

export type AgreementInfoPayload = BasePayload

export interface AgreementSizeExceededPayload extends BasePayload {
  hash: string
  size: number
  expectedSize: number
}

// Incoming messages

export interface MultiaddrAnnouncementPayload {
  agreementReference: string
  peerId: string
}

export interface ResendMessagesPayload {
  requestId: string
  agreementReference: string
  code?: string
}

export interface CommsMessage<Payload> {
  timestamp: number
  version: number
  code: string
  payload: Payload
}
