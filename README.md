# RIF Storage.js IPFS Pinning service

[![CircleCI](https://flat.badgen.net/circleci/github/rsksmart/rds-ipfs/master)](https://circleci.com/gh/rsksmart/rds-ipfs/)
[![Dependency Status](https://david-dm.org/rsksmart/rds-ipfs.svg?style=flat-square)](https://david-dm.org/rsksmart/rds-ipfs)
[![](https://img.shields.io/badge/made%20by-IOVLabs-blue.svg?style=flat-square)](http://iovlabs.org)
[![](https://img.shields.io/badge/project-RIF%20Storage-blue.svg?style=flat-square)](https://www.rifos.org/)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)
[![Managed by tAsEgir](https://img.shields.io/badge/%20managed%20by-tasegir-brightgreen?style=flat-square)](https://github.com/auhau/tasegir)
![](https://img.shields.io/badge/npm-%3E%3D6.0.0-orange.svg?style=flat-square)
![](https://img.shields.io/badge/Node.js-%3E%3D10.0.0-orange.svg?style=flat-square)

> Application for providing your storage space on IPFS network to other to use in exchange of RIF Tokens

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [License](#license)

## Install

### npm

```sh
> npm install @rsksmart/rif-storage-ipfs-pinning
```

**WARNING: This package still have not been released!**

## Usage

Example of usage:
```bash
$ rif-pinning --offerId 0x123456789 --provider 'ws://localhost:8546' --ipfs '/ip4/127.0.0.1/tcp/5001' --network testnet
```

This will:
 - start the pinning service
 - listens only for events for the offer ID `0x123456789`
 - use blockchain node for listening on events at `ws://localhost:8546` that is connected to testnet network
 - thanks to `--network testnet` will use predefined deployed smart-contracts on testnet
 - connects to your locally running IPFS node at `/ip4/127.0.0.1/tcp/5001`

```
USAGE
  $ rif-pinning --offerId=OFFER_ID

OPTIONS
  -n, --network=testnet|mainnet        specifies to which network is the provider connected
  -o, --offerId=offerId                (required) ID of Offer to which should the service listen to
  -p, --provider=provider              URL to blockchain node provider

  --ipfs=ipfs                          specifies a connection URL to IPFS node. Default is go-ipfs
                                       listening configuration.

  --log=error|warn|info|verbose|debug  [default: error] what level of information to log

  --log-filter=log-filter              what components should be logged (+-, chars allowed)

  --log-path=log-path                  log to file, default is STDOUT

  --remove-cache                       removes the local database
```

## Contribute

There are some ways you can make this module better:

- Consult our [open issues](https://github.com/rsksmart/rds-ipfs/issues) and take on one of them
- Help our tests reach 100% coverage!

### Development

**Requirements:**

 * IPFSv5 and higher
 * Ganache
 * Node & NPM

Please on how to setup the development environment see [Development guide](./DEVELOPMENT.md)

#### Tips

 - Using the `npm run ipfs:consumer` and `npm run ipfs:provider` you can interact with
 each IPFS node using the standard commands that IPFS supports.
 - You can interact with the CLI using `npm run bin` script from the local folder.

## License

[MIT](./LICENSE)
