import { setup, getPinningContract } from './contract'
import { waitForEnter } from './utils'

(async function main (): Promise<void> {
  setup()
  const contract = await getPinningContract()

  contract.events.allEvents({}, (err: Error, event: { event: string }) => {
    if (err) {
      console.error(`>>> ERROR! ${err}`)
      return
    }

    console.log('>>> NEW EVENT: ', event.event)
    console.log(event)
  })
})().catch(e => console.error(e))

waitForEnter()
