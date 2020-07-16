interface EventProcessorI {
    offerId: string
    initialized: boolean
}

export abstract class EventProcessor implements EventProcessorI {
    public offerId: string
    public initialized = false

    protected constructor (offerId: string) {
      this.offerId = offerId
    }

    abstract async precache (): Promise<void>
    abstract async initialize (): Promise<void>
    abstract async run (): Promise<void>
    abstract stop (): void
}
