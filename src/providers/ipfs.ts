import ipfsClient, { CID, ClientOptions, IpfsClient, Version } from 'ipfs-http-client'
import * as semver from 'semver'

import type { Provider } from '../definitions'
import { loggingFactory } from '../logger'

const logger = loggingFactory('ipfs')

const REQUIRED_IPFS_VERSION = '>=0.5.0'

export class IpfsProvider implements Provider {
  private readonly ipfs: IpfsClient
  private readonly statTimeout?: number | string

  constructor (ipfs: IpfsClient, statTimeout?: number | string) {
    this.ipfs = ipfs
    this.statTimeout = statTimeout
  }

  static async bootstrap (options?: ClientOptions | string, statTimeout?: number | string): Promise<IpfsProvider> {
    if (!options) {
      // Default location of local node, lets try that one
      options = '/ip4/127.0.0.1/tcp/5001'
    }

    const ipfs = ipfsClient(options)

    let versionObject: Version
    try {
      versionObject = await ipfs.version()
    } catch (e) {
      if (e.code === 'ECONNREFUSED') {
        throw new Error(`No running IPFS daemon on ${typeof options === 'object' ? JSON.stringify(options) : options}`)
      }

      throw e
    }

    if (!semver.satisfies(versionObject.version, REQUIRED_IPFS_VERSION)) {
      throw new Error(`Supplied IPFS node is version ${versionObject.version} while this utility requires version ${REQUIRED_IPFS_VERSION}`)
    }

    return new this(ipfs, statTimeout)
  }

  /**
   *
   * TODO: Verify that the file has given size! ipfs.object.stat FTW
   * TODO: Error handling
   * @param hash
   * @param expectedSize
   */
  async pin (hash: string, expectedSize: number): Promise<void> {
    hash = hash.replace('/ipfs/', '')
    const cid = new CID(hash)

    logger.verbose(`Retrieving size of CID ${hash}`)
    try {
      const stats = await this.ipfs.object.stat(cid, { timeout: this.statTimeout })

      if (stats.CumulativeSize > expectedSize) {
        logger.error(`The hash ${hash} has cumulative size of ${stats.CumulativeSize} bytes while it was expected to have ${expectedSize} bytes.`)
        throw new Error('The hash exceeds payed size!')
      }
    } catch (e) {
      if (e.name === 'TimeoutError') {
        logger.error(`Fetching size of ${hash} timed out!`)
        return // Since we can't validate the size we won't pin it! Most probably the file is not in the network.
      } else {
        throw e
      }
    }

    const start = process.hrtime()
    logger.info(`Pinning hash: ${hash} start`)
    // TODO: For this call there is applied the default 20 minutes timeout. This should be estimated using the size.
    //  https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-http-client/src/lib/core.js#L113
    await this.ipfs.pin.add(cid) // The data can be big and we don't want to automatically timeout here.
    logger.info(`Pinning hash: ${hash} ended in ${process.hrtime(start)[0]}s`)
  }

  async unpin (hash: string): Promise<void> {
    logger.info(`Unpinning hash: ${hash}`)
    hash = hash.replace('/ipfs/', '')
    const cid = new CID(hash)
    await this.ipfs.pin.rm(cid)
  }
}
