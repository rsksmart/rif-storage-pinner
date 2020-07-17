import type { CacheEvent, BaseEventProcessorOptions, HandlersObject } from '../../definitions'
import { loggingFactory } from '../../logger'
import { buildHandler } from '../../utils'

const logger = loggingFactory('processor:cache:offer')

const handlers: HandlersObject<CacheEvent, BaseEventProcessorOptions> = {
  TotalCapacitySet (event: CacheEvent): Promise<void> {
    return Promise.reject(new Error('Not implemented!'))
  },
  MessageEmitted (event: CacheEvent): Promise<void> {
    return Promise.reject(new Error('Not implemented!'))
  }
}

export default buildHandler<CacheEvent, BaseEventProcessorOptions>(
  handlers,
  ['TotalCapacitySet', 'MessageEmitted']
)
