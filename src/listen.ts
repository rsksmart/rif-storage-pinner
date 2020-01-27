import { setup, getContract } from './contract'
import { waitForEnter } from './utils'

(async function main (): Promise<void> {
  setup()
  const contract = await getContract()

  contract.events.allEvents({}, (err: string, event: { event: string }) => {
    if (err) {
      console.error(`>>> ERROR! ${err}`)
      return
    }

    console.log('>>> NEW EVENT: ', event.event)
    console.log(event)
  })
})().catch(e => console.error(e))

waitForEnter()
