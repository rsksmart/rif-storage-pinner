
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
 * Error for Jobs that signifies an error that is pointless to retry the job with.
 */
export class NonRecoverableError extends Error {
  static code = 'NON_RECOVERABLE_ERR'
  public code: string

  constructor (message: string) {
    super(message)
    this.name = 'NonRecoverableError'
    this.code = NonRecoverableError.code
  }
}
