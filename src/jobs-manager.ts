import { EventEmitter } from 'events'

import JobModel from './models/job.model'
import { runAndAwaitFirstEvent, sleep } from './utils'
import { loggingFactory } from './logger'
import { JobManagerOptions, JobState, MessageCodesEnum } from './definitions'
import { broadcast } from './communication'
import { HashExceedsSizeError, JobsError } from './errors'

const logger = loggingFactory('jobs')
export const FINISHED_EVENT_NAME = 'finished'

export abstract class Job extends EventEmitter {
  public readonly entity: JobModel

  protected constructor (name: string, type?: string) {
    super()

    this.entity = new JobModel({ name, type })
  }

  abstract async _run (): Promise<void>

  get name (): string {
    return this.entity.name
  }

  get type (): string {
    return this.entity.type
  }

  get state (): string {
    return this.entity.state
  }

  public run (): void {
    (async () => {
      try {
        this.entity.state = JobState.RUNNING
        this.entity.start = new Date(Date.now())
        await this.entity.save()

        await this._run()

        this.entity.state = JobState.FINISHED
        this.entity.finish = new Date(Date.now())
        await this.entity.save()
        this.emit(FINISHED_EVENT_NAME)
      } catch (e) {
        this.entity.state = JobState.ERRORED
        this.entity.finish = new Date(Date.now())
        this.entity.errorMessage = e.message
        await this.entity.save()
        this.emit('error', e)
      }
    })()
  }

  public async retry (count: number, total: number): Promise<void> {
    this.entity.retry = `${count}/${total}`
    this.entity.state = JobState.BACKOFF
    await this.entity.save()
  }
}

const DEFAULT_RETRIES = 3

export class JobsManager {
  private readonly retries: number
  private readonly backoffStart: number
  private readonly isExponentialBackoff: boolean

  constructor (options?: JobManagerOptions) {
    this.retries = options?.retries ?? DEFAULT_RETRIES
    this.backoffStart = options?.backoffTime ?? 0
    this.isExponentialBackoff = options?.exponentialBackoff ?? false
  }

  private async handleError (job: Job, e: JobsError | HashExceedsSizeError): Promise<never> {
    if (HashExceedsSizeError.is(e)) {
      await broadcast(MessageCodesEnum.E_AGREEMENT_SIZE_LIMIT_EXCEEDED, {
        hash: job.name,
        size: e.currentSize,
        expectedSize: e.expectedSize
      })
    } else {
      await broadcast(MessageCodesEnum.E_GENERAL, {
        hash: job.name,
        error: e.message
      })
    }

    throw e
  }

  public async run (job: Job): Promise<void> {
    const start = process.hrtime()
    let backoff = this.backoffStart

    for (let retry = 1; retry <= this.retries; retry++) {
      try {
        logger.info(`Starting job (${job.name})`)
        await broadcast(MessageCodesEnum.I_HASH_START, { hash: job.name })
        await runAndAwaitFirstEvent(job, FINISHED_EVENT_NAME, () => { job.run() })
        await broadcast(MessageCodesEnum.I_HASH_PINNED, { hash: job.name })
        logger.info(`Finished job in ${process.hrtime(start)[0]}s (${job.name})`)
        break // Lets exit then!
      } catch (e) {
        // If the Error directly specifies that it does not make sense to retry the Job, exit immediately
        if (e.retryable === false) {
          await this.handleError(job, e)
        }

        logger.error(`While ${retry}/${this.retries} try of job ${job.name} error happened: ${e}`)

        if (retry === this.retries) { // Last retry ==> reject the promise
          await this.handleError(job, e)
        } else {
          await job.retry(retry, this.retries)

          await broadcast(MessageCodesEnum.W_HASH_RETRY, {
            hash: job.name,
            retryNumber: retry,
            totalRetries: this.retries,
            error: e.message
          })

          if (backoff > 0) {
            logger.verbose(`Backing off for ${backoff / 1000}s (${job.name})`)
            await sleep(backoff)

            // eslint-disable-next-line max-depth
            if (this.isExponentialBackoff) {
              backoff *= 2
            }
          }
        }
      }
    }
  }
}
