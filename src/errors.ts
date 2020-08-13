import type BigNumber from 'bignumber.js'
/**
 * Error for problems during processing of received events
 */
export class EventError extends Error {
  static code = 'EVENT_ERR'
  public code: string

  constructor (message: string, event?: string) {
    if (event) {
      message = `During processing event ${event}: ${message}`
    }

    super(message)
    this.name = 'EventError'
    this.code = EventError.code
  }
}

/**
 * General error that should be used inside of Jobs as it has ability to specify
 * if Jobs should be retried or not and other aspects.
 */
export class JobsError extends Error {
  static code = 'JOBS_ERR'
  public code: string
  _retryable: boolean

  constructor (message: string, retryable = true) {
    super(message)
    this.name = 'JobsError'
    this.code = JobsError.code
    this._retryable = retryable
  }

  get retryable (): boolean {
    return this._retryable
  }
}

/**
 * Error for Providers when they detect that
 */
export class HashExceedsSizeError extends JobsError {
  static code = 'HASH_EXCEEDS_SIZE_ERR'
  public code: string
  private readonly _currentSize: BigNumber
  private readonly _expectedSize: BigNumber

  static is (e: any): e is HashExceedsSizeError {
    return e.code === HashExceedsSizeError.code
  }

  constructor (message: string, currentSize: BigNumber, expectedSize: BigNumber) {
    super(message, false)
    this.name = 'HASH_EXCEEDS_SIZE_ERR'
    this.code = HashExceedsSizeError.code
    this._currentSize = currentSize
    this._expectedSize = expectedSize
  }

  get currentSize (): BigNumber {
    return this._currentSize
  }

  get expectedSize (): BigNumber {
    return this._expectedSize
  }
}
