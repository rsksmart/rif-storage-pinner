import PinningService from './app'
import { AppOptions } from './definitions'

export default async (offerId: string, options?: AppOptions): Promise<{ stop: () => void }> => {
  const pinningApp = new PinningService(offerId, options)
  // Init database connection, ipfs-node connection and perform precache if needed
  await pinningApp.init()
  // Subscribe and start processing events
  await pinningApp.start()

  return { stop: (): Promise<void> => pinningApp.stop() }
}
