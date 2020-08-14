declare module 'peer-id' {
  interface PeerIdJson {
    id: string
    pubKey: string
    privKey: string
  }

  export default class PeerId {
    constructor (id: Buffer, privKey?: string, pubKey?: string)

    static create (opts?: { bits: number, keyType: 'rsa' | 'ed25519' | 'secp256k1' }): Promise<PeerId>

    static createFromJSON (json: PeerIdJson): Promise<PeerId>

    isValid (): boolean

    toB58String (): string

    toJSON (): PeerIdJson
  }
}
