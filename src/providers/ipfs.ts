import ipfsClient, { CID, ClientOptions, IpfsClient, IpfsResult, Version } from 'ipfs-http-client'
import * as semver from 'semver'

import type { Provider } from '../definitions'
import { loggingFactory } from '../logger'

const logger = loggingFactory('ipfs')

const REQUIRED_IPFS_VERSION = '>=0.5.0'

export class IpfsProvider implements Provider {
  private readonly ipfs: IpfsClient

  constructor (ipfs: IpfsClient) {
    this.ipfs = ipfs
  }

  static async bootstrap (options?: ClientOptions | string): Promise<IpfsProvider> {
    if (!options) {
      // Default location of local node, lets try that one
      options = '/ip4/127.0.0.1/tcp/5001'
    }

    const ipfs = await ipfsClient(options)

    let versionObject: Version
    try {
      // todo handle timeout
      versionObject = await ipfs.version({ timeout: 2000 })
    } catch (e) {
      if (e.code === 'ECONNREFUSED' || e.message === 'Request timed out') {
        throw new Error(`No running IPFS daemon on ${typeof options === 'object' ? JSON.stringify(options) : options}`)
      }

      throw e
    }

    if (!semver.satisfies(versionObject.version, REQUIRED_IPFS_VERSION)) {
      throw new Error(`Supplied IPFS node is version ${versionObject.version} while this utility requires version ${REQUIRED_IPFS_VERSION}`)
    }

    return new this(ipfs)
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
    const stats = await this.ipfs.object.stat(cid)

    if (stats.CumulativeSize > expectedSize) {
      logger.error(`The hash ${hash} has cumulative size of ${stats.CumulativeSize} bytes while it was expected to have ${expectedSize} bytes.`)
      throw new Error('The hash exceeds payed size!')
    }

    const start = process.hrtime()
    logger.info(`Pinning hash: ${hash} start`)
    await this.ipfs.pin.add(cid)
    logger.info(`Pinning hash: ${hash} ended in ${process.hrtime(start)[0]}s`)
  }

  async unpin (hash: string): Promise<void> {
    logger.info(`Unpinning hash: ${hash}`)
    hash = hash.replace('/ipfs/', '')
    const cid = new CID(hash)
    await this.ipfs.pin.rm(cid)
  }

  add (data: any): Promise<Array<IpfsResult>> {
    logger.info('Upload file')
    return this.ipfs.add(data)
  }

  ls (hash: string): AsyncIterable<{ cid: CID, type: string }> {
    hash = hash.replace('/ipfs/', '')
    const cid = new CID(hash)
    return this.ipfs.pin.ls(cid)
  }
}
