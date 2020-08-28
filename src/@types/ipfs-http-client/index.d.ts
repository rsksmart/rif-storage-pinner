// WIP ==> NOT ALL FUNCTIONS ARE COVERED!!!

// TODO: Add pull-stream supports

declare module 'ipfs-http-client' {
  import multiaddr from 'multiaddr'
  import CID from 'cids'
  import { Readable } from 'stream'
  import exp from 'constants'

  export type CidAddress = CID | Buffer | string

  interface Options {
    timeout?: number | string
    headers?: object
    signal?: any
  }

  export interface IpfsResult {
    path: string
    size: number
    hash: string
    cid: CID
    mode: number
    mtime: { secs: number, nsecs: number }
  }

  export interface IpfsObject<T> {
    path: string
    content?: T
  }

  export namespace RegularFiles {

    export interface GetOptions extends Options {
      offset?: string
      length?: string
      compress?: string
      compressionLevel?: string
    }

    export interface LsOptions extends Options {
      recursive?: boolean
    }

    export interface AddOptions extends Options {
      chunker?: string
      cidVersion?: 0 | 1
      cidBase?: string // TODO: Add base values
      hashAlg?: string // TODO: Add possible hash-functions values
      hash?: string
      onlyHash?: boolean
      pin?: boolean
      quiet?: boolean
      quieter?: boolean
      rawLeaves?: boolean
      recursive?: boolean
      shardSplitThreshold?: number
      silent?: boolean
      trickle?: boolean
      wrapWithDirectory?: boolean
    }

    export interface LsResult extends IpfsResult {
      name: string
      type: string
      depth: number
    }

    export interface RegularFilesCommands {
      add (data: Buffer | File | Readable | IpfsObject<Buffer | File | Readable | string>, options?: AddOptions): Promise<IpfsResult>
      // addFromFs
      // addFromStream
      // addFromUrl
      // addFromPullStream

      cat (path: CidAddress, options?: Options): AsyncIterator<Buffer>

      _getAsyncIterator (path: CidAddress, options?: GetOptions): AsyncIterator<IpfsObject<Buffer>>
      get (path: CidAddress, options?: GetOptions): Promise<Array<IpfsObject<Buffer>>>
      getReadableStream (path: CidAddress, options?: GetOptions): Readable
      // getPullStream

      _lsAsyncIterator (path: CidAddress, options?: LsOptions): AsyncIterator<LsResult>
      ls (path: CidAddress, options?: LsOptions): Promise<Array<LsResult>>
      lsReadableStream (path: CidAddress, options?: LsOptions): Readable
    }

  }

  export interface Identity {
    id: string
    publicKey: string
    addresses: Array<string>
    agentVersion: string
    protocolVersion: string
  }

  export interface Version {
    version: string
    commit: string
    repo: string
    system: string
    golang: string
  }

  export interface MiscellaneousCommands {
    send (options: object, cb: () => void): void
    id (): Promise<Identity>
    version (): Promise<Version>
  }

  export interface PinCommands {
    pin: {
      add (cid: CID, options?: { recursive?: boolean } & Options): Promise<Array<{ cid: CID }>>
      ls (options?: Options & { paths?: CID | string }): AsyncIterable<{ cid: CID, type: string }>
      rm (cid: CID, options?: { recursive?: boolean } & Options): Promise<Array<{ cid: CID }>>
    }
  }

  export interface StatObject {
    Hash: string
    NumLinks: number
    BlockSize: number
    LinksSize: number
    DataSize: number
    CumulativeSize: number
  }

  export interface ObjectCommands {
    object: {
      stat (cid: CID, options?: Options): Promise<StatObject>
    }
  }

  export interface SwarmCommands {
    swarm: {
      addrs(options?: Options): Promise<any>
      connect(addrs: multiaddr | multiaddr[], options?: Options): Promise<any>
      disconnect(addrs: multiaddr | multiaddr[], options?: Options): Promise<any>
      localAddrs(options?: Options): Promise<{ id: any, addrs: any }>
      peers(options?: Options & { direction: boolean, verbose: boolean }): Promise<{ addr: multiaddr, [key: string]: any }[]>
    }
  }

  export interface DHTCommands {
    dht: {
      findPeer(peerId: CID, options?: Options): Promise<{ id: any, addrs: Array<multiaddr> }>
    }
  }

  export type IpfsClient = MiscellaneousCommands & RegularFiles.RegularFilesCommands & PinCommands & ObjectCommands & SwarmCommands & DHTCommands

  interface Port {
    port: string
  }

  export interface ClientOptions {
    url?: string
    host?: string
    port?: number
    protocol?: string
    'api-path'?: string
    'user-agent'?: string
    headers?: object
    timeout?: number | string
  }

  export default function ipfsClient (hostOrMultiaddr?: multiaddr | ClientOptions | string, port?: Port | string, userOptions?: ClientOptions): IpfsClient
  export { multiaddr, CID }
}
