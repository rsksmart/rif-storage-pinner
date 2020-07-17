import { AbiItem } from 'web3-utils'
import Eth from 'web3-eth'
import { EventEmitter } from 'events'
import config from 'config'

import { loggingFactory } from '../logger'
import eventsEmitterFactory, { BaseEventsEmitter, EventsEmitterOptions } from './events'
import { AppOptions, NewBlockEmitterOptions } from '../definitions'
import { ListeningNewBlockEmitter, PollingNewBlockEmitter } from './new-block-emitters'

const logger = loggingFactory('blockchain')

export function setDifference<T> (setA: Set<T>, setB: Set<T>): Set<T> {
  const _difference = new Set(setA)
  for (const elem of setB) {
    _difference.delete(elem)
  }
  return _difference
}

/**
 * Function that will split array into two groups based on callback
 *
 * @param arr
 * @param callback
 * @return [success, failure] array where first are positives based on callback and second are negatives
 */
export async function asyncSplit<T> (arr: T[], callback: (elem: T) => Promise<boolean>): Promise<[T[], T[]]> {
  const splitArray = await Promise.all(arr.map(async item => await callback(item)))
  return arr.reduce<[T[], T[]]>(([pass, fail], elem, currentIndex) => {
    return splitArray[currentIndex] ? [[...pass, elem], fail] : [pass, [...fail, elem]]
  }, [[], []])
}

export async function getBlockDate (eth: Eth, blockNumber: number): Promise<Date> {
  return new Date(((await eth.getBlock(blockNumber)).timestamp as number) * 1000)
}

export function ethFactory (): Eth {
  const provider = Eth.givenProvider || config.get('blockchain.provider')
  logger.info(`Connecting to provider ${provider}`)

  return new Eth(provider)
}

export function getNewBlockEmitter (eth: Eth): EventEmitter {
  const newBlockEmitterOptions = config.get<NewBlockEmitterOptions>('blockchain.newBlockEmitter')

  if (newBlockEmitterOptions.polling) {
    return new PollingNewBlockEmitter(eth, newBlockEmitterOptions.pollingInterval)
  } else {
    return new ListeningNewBlockEmitter(eth)
  }
}

export function getEventsEmitter (eth: Eth, contractAbi: AbiItem[], options?: EventsEmitterOptions & { contractAddress?: string }): BaseEventsEmitter {
  const contractAddresses = options?.contractAddress || config.get<string>('blockchain.contractAddress')
  const contract = new eth.Contract(contractAbi, contractAddresses)
  const logger = loggingFactory('blockchain:')

  const eventsToListen = config.get<string[]>('blockchain.events')
  logger.info(`For listening on service 'blockchain' for events ${eventsToListen.join(', ')} using contract on address: ${contractAddresses}`)
  const eventsEmitterOptions = config.get<EventsEmitterOptions>('blockchain.eventsEmitter')
  const newBlockEmitterOptions = config.get<NewBlockEmitterOptions>('blockchain.newBlockEmitter')
  const configOptions = Object.assign(
    {},
    eventsEmitterOptions,
    {
      newBlockEmitter: newBlockEmitterOptions
    } as EventsEmitterOptions,
    options
  )

  return eventsEmitterFactory(eth, contract, eventsToListen, configOptions)
}
