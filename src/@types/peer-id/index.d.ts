declare module 'peer-id' {
  interface PeerIdJson {
    id: string
    pubKey: string
    privKey: string
  }

  export default class PeerId {
    constructor (id: Buffer, privKey?: string, pubKey?: string)

    static create (opts?: { bits: number, keyType: 'rsa' | 'ed25519' | 'secp256k1' }): PeerId

    toB58String (): string
    toJSON(): PeerIdJson
  }
}
