import ipfsClient, { CID, ClientOptions, IpfsClient, multiaddr, Version } from 'ipfs-http-client'
import * as semver from 'semver'
import config from 'config'
import BigNumber from 'bignumber.js'
import fetch, { RequestInit } from 'node-fetch'

import type { Provider } from '../definitions'
import { loggingFactory } from '../logger'
import { Job, JobsManager } from '../jobs-manager'
import { HashExceedsSizeError, NotPinnedError } from '../errors'
import { bytesToMegabytes } from '../utils'
import DirectAddressModel from '../models/direct-address.model'

const logger = loggingFactory('ipfs')

const REQUIRED_IPFS_VERSION = '>=0.5.0'
const NOT_PINNED_ERROR_MSG = 'not pinned or pinned indirectly'

const MIN_PIN_TIMEOUT = 60000 * 20 // 20 minutes
const RATE_MB_PER_SECOND = 0.5

export class PinJob extends Job {
  private readonly hash: string
  private readonly ipfs: IpfsClient
  private readonly expectedSize: BigNumber
  private swarmAddresses: multiaddr[] | undefined

  constructor (ipfs: IpfsClient, hash: string, expectedSize: BigNumber, agreementReference: string) {
    super(hash, agreementReference, 'ipfs - pin')

    this.expectedSize = expectedSize
    this.ipfs = ipfs
    this.hash = hash
  }

  private async getPeerIdByAgreement (agreementReference: string): Promise<string | undefined> {
    const directAddress = await DirectAddressModel.findOne({ where: { agreementReference } })
    await DirectAddressModel.destroy({ where: { agreementReference } })
    return directAddress?.peerId
  }

  private async getPeer (): Promise<{ id: string, addresses: multiaddr[] } | undefined> {
    const peerId = await this.getPeerIdByAgreement(this.agreementReference)

    if (!peerId) return undefined
    const peer = await this.ipfs.dht.findPeer(new CID(peerId))

    if (!peer) return undefined
    return {
      ...peer,
      addresses: peer.addrs.map(addr => multiaddr(`${addr.toString()}/p2p/${peer.id}`))
    }
  }

  private async swarmConnect (): Promise<void> {
    logger.debug('In Pinning Job Swarm connect')

    this.swarmAddresses = (await this.getPeer())?.addresses

    if (this.swarmAddresses) {
      await this.ipfs.swarm.connect(this.swarmAddresses)
    }
  }

  private async swarmDisconnect (): Promise<void> {
    logger.debug('In Pinning Job Swarm disconnect')

    // Disconnect from peer
    if (this.swarmAddresses) {
      await this.ipfs.swarm.disconnect(this.swarmAddresses)
    }
  }

  private async pinProcess (cid: CID, { timeout }: { timeout?: number}): Promise<void> {
    const hash = this.hash.replace('/ipfs/', '')
    await this.swarmConnect().catch(logger.warn)

    logger.info(`Pinning hash: ${hash} start`)
    await this.ipfs.pin.add(cid, { timeout })
    await this.swarmDisconnect().catch(logger.warn)
  }

  private getMetaFileSize (cid: CID): Promise<BigNumber> {
    return this.ipfs.object.stat(
      cid,
      { timeout: config.get<number | string>('ipfs.sizeFetchTimeout') }
    )
      .then(({ CumulativeSize }) => bytesToMegabytes(CumulativeSize))
      .catch(e => {
        if (e.name === 'TimeoutError') {
          logger.error(`Fetching size of ${cid.toString()} timed out!`)
          throw new Error(`Fetching size of ${cid.toString()} timed out!`)
        }
        throw e
      })
  }

  private getActualFileSize (cid: CID): Promise<BigNumber> {
    return this.ipfs.dag.stat(
      cid,
      { timeout: config.get<number | string>('ipfs.sizeFetchTimeout') })
      .then(res => {
        return bytesToMegabytes(res.Size)
      })
      .catch(e => {
        if (e.name === 'TimeoutError') {
          logger.error(`Fetching size of ${cid.toString()} timed out!`)
          throw new Error(`Fetching size of ${cid.toString()} timed out!`)
        }
        throw e
      })
  }

  async _run (): Promise<void> {
    const hash = this.hash.replace('/ipfs/', '')
    const cid = new CID(hash)

    // METADATA SIZE CHECK
    logger.verbose(`(${hash}) Retrieving meta size of CID`)
    const metadataSizeMb = await this.getMetaFileSize(cid) // In MB

    if (metadataSizeMb.gt(this.expectedSize)) {
      logger.error(`The hash ${hash} has cumulative size of ${metadataSizeMb.toString()} megabytes while it was expected to have ${this.expectedSize} megabytes.`)
      throw new HashExceedsSizeError('The hash exceeds payed size!', metadataSizeMb, this.expectedSize)
    }

    // PIN PROCESS
    // We can be generous on the actual pinning timeout as if the CID would not be present
    // in IPFS network, then the previous ipfs.object.stat() call would timeout already then.
    // We are using 0.5 MB per second transfer rate, with keeping at least 20 minutes as default.
    // SizeInMB * 0.5 * 1000 ==> ms
    const estimatedTimeout = Math.max(MIN_PIN_TIMEOUT, metadataSizeMb.div(RATE_MB_PER_SECOND).multipliedBy(1000).toNumber())
    await this.pinProcess(cid, { timeout: estimatedTimeout })

    // ACTUAL SIZE CHECK
    logger.verbose(`(${hash}) Retrieving actual size of CID`)
    const sizeInMb = await this.getActualFileSize(cid) // In MB

    if (sizeInMb.gt(this.expectedSize)) {
      logger.error(`The hash ${hash} has cumulative size of ${sizeInMb.toString()} megabytes while it was expected to have ${this.expectedSize} megabytes.`)
      // Unpin file
      logger.info(`Unpin file ${hash} due to exceed size limit`)
      await this.ipfs.pin.rm(cid)
      throw new HashExceedsSizeError('The hash exceeds payed size!', sizeInMb, this.expectedSize)
    }
  }
}

export function getDagStat (nodeUrl: string): (cid: CID, options?: any) => Promise<any> {
  return (cid: CID, options?: RequestInit): Promise<any> =>
    fetch(`${nodeUrl}/api/v0/dag/stat?arg=${cid.toString()}`, { method: 'POST', ...options })
}

export class IpfsProvider implements Provider {
  private readonly ipfs: IpfsClient
  private jobsManager: JobsManager

  constructor (jobsManager: JobsManager, ipfs: IpfsClient) {
    this.ipfs = ipfs
    this.jobsManager = jobsManager
  }

  static async bootstrap (jobsManager: JobsManager, options?: ClientOptions | string): Promise<IpfsProvider> {
    if (!options) {
      // Default location of local node, lets try that one
      options = '/ip4/127.0.0.1/tcp/5001'
    }

    const ipfs = ipfsClient(options)
    // TODO: Remove that when ipfs-js fully support this API
    ipfs.dag.stat = getDagStat(typeof options === 'string' ? options : options.url as string)

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

    return new this(jobsManager, ipfs)
  }

  /**
   *
   * @param hash
   * @param expectedSize
   * @param agreementReference
   */
  pin (hash: string, expectedSize: BigNumber, agreementReference: string): Promise<void> {
    const job = new PinJob(this.ipfs, hash, expectedSize, agreementReference)
    return this.jobsManager.run(job)
  }

  async unpin (hash: string): Promise<void> {
    logger.info(`Unpinning hash: ${hash}`)
    hash = hash.replace('/ipfs/', '')
    const cid = new CID(hash)

    try {
      await this.ipfs.pin.rm(cid)
    } catch (e) {
      if (e.message === NOT_PINNED_ERROR_MSG) {
        throw new NotPinnedError(`${hash} is not pinned or pinned indirectly`)
      } else {
        throw e
      }
    }
  }
}
