import { Provider } from '../definitions'
import { IpfsProvider } from './ipfs'

/**
 * Provider which redirects the pin/unpin requests to the correct provider
 * based on the structure of the hash.
 */
export class ProviderManager implements Provider {
  private ipfs?: IpfsProvider

  public register (provider: Provider): void {
    if (provider instanceof IpfsProvider) {
      this.ipfs = provider
    }
  }

  public async pin (hash: string, expectedSize: number): Promise<void> {
    if (hash.startsWith('/ipfs/')) {
      if (!this.ipfs) {
        throw new Error('IPFS provider was not registered!')
      }

      await this.ipfs.pin(hash, expectedSize)
    } else {
      throw new Error(`Unknown type of hash ${hash}`)
    }
  }

  public async unpin (hash: string): Promise<void> {
    if (hash.startsWith('/ipfs/')) {
      if (!this.ipfs) {
        throw new Error('IPFS provider was not registered!')
      }

      await this.ipfs.unpin(hash)
    } else {
      throw new Error(`Unknown type of hash ${hash}`)
    }
  }
}
