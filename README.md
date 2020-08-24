# RIF Storage.js Pinning service

[![CircleCI](https://flat.badgen.net/circleci/github/rsksmart/rif-storage-pinner/master)](https://circleci.com/gh/rsksmart/rif-storage-pinner/)
[![Dependency Status](https://david-dm.org/rsksmart/rif-storage-pinner.svg?style=flat-square)](https://david-dm.org/rsksmart/rif-storage-pinner)
[![](https://img.shields.io/badge/made%20by-IOVLabs-blue.svg?style=flat-square)](http://iovlabs.org)
[![](https://img.shields.io/badge/project-RIF%20Storage-blue.svg?style=flat-square)](https://www.rifos.org/)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)
[![Managed by tAsEgir](https://img.shields.io/badge/%20managed%20by-tasegir-brightgreen?style=flat-square)](https://github.com/auhau/tasegir)
![](https://img.shields.io/badge/npm-%3E%3D6.0.0-orange.svg?style=flat-square)
![](https://img.shields.io/badge/Node.js-%3E%3D10.0.0-orange.svg?style=flat-square)

> Application for providing your storage space on decentralized storage networks to other to use in exchange of RIF Tokens

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [License](#license)

## Install

### npm

```sh
> npm install @rsksmart/rif-storage-pinning
```

## Usage

Example of usage:
```bash
$ rif-pinning init --offerId=0x123456789
$ rif-pinning --provider='ws://localhost:8546' --ipfs='/ip4/127.0.0.1/tcp/5001' --network=testnet --strategy=blockchain
```

This will:
 - initialize pinning service for given Offer
 - start the daemon of the pinning service
 - listens only for events for the Offer ID `0x123456789`
 - use blockchain node for listening on events at `ws://localhost:8546` that is connected to testnet network
 - thanks to `--network testnet` will use predefined deployed smart-contracts on testnet
 - connects to your locally running IPFS node at `/ip4/127.0.0.1/tcp/5001`

## Commands
<!-- commands -->
* [`rif-pinning agreements`](#rif-pinning-agreements)
* [`rif-pinning cleanup`](#rif-pinning-cleanup)
* [`rif-pinning daemon`](#rif-pinning-daemon)
* [`rif-pinning db-migration`](#rif-pinning-db-migration)
* [`rif-pinning help [COMMAND]`](#rif-pinning-help-command)
* [`rif-pinning init`](#rif-pinning-init)

#### `rif-pinning agreements`

Agreements info

```
USAGE
  $ rif-pinning agreements

OPTIONS
  -d, --db=db                                                   Name or path to DB file
  -p, --pinningStatus=running|backoff|created|finished|errored  Filter by pinning status
  -s, --status=active|inactive                                  Filter by status
  --config=config                                               path to JSON config file to load
  --log=error|warn|info|verbose|debug                           [default: error] what level of information to log
  --log-filter=log-filter                                       what components should be logged (+-, chars allowed)
  --log-path=log-path                                           log to file, default is STDOUT
  --skipPrompt                                                  Answer yes for any prompting

EXAMPLES
  $ rif-pinning agreements
  $ rif-pinning agreements --db myOffer.sqlite
  $ rif-pinning agreements --ls -f active
  $ rif-pinning agreements --ls -f inactive
  $ rif-pinning agreements --ls -f inactive -p pinned
  $ rif-pinning agreements --ls -f active -p not-pinned
```

### `rif-pinning cleanup`

Cleanup pinner files

```
USAGE
  $ rif-pinning cleanup

OPTIONS
  -d, --db=db                          Name or path to DB file
  -u, --unpin                          Unpin all files
  --config=config                      path to JSON config file to load
  --log=error|warn|info|verbose|debug  [default: error] what level of information to log
  --log-filter=log-filter              what components should be logged (+-, chars allowed)
  --log-path=log-path                  log to file, default is STDOUT
  --skipPrompt                         Answer yes for any prompting

EXAMPLES
  $ rif-pinning cleanup
  $ rif-pinning cleanup --db myOffer.sqlite
  $ rif-pinning cleanup --unpin
```

### `rif-pinning daemon`

Run pinning service

```
USAGE
  $ rif-pinning daemon

OPTIONS
  -d, --db=db                          Name or path to DB file
  -n, --network=testnet|mainnet        specifies to which network is the provider connected
  -p, --provider=provider              URL to blockchain node or Marketplace server
  --config=config                      path to JSON config file to load

  --ipfs=ipfs                          specifies a connection URL to IPFS node. Default is go-ipfs listening
                                       configuration.

  --log=error|warn|info|verbose|debug  [default: error] what level of information to log

  --log-filter=log-filter              what components should be logged (+-, chars allowed)

  --log-path=log-path                  log to file, default is STDOUT

  --skipPrompt                         Answer yes for any prompting

  --strategy=marketplace|blockchain    what type of provider will be used for listening on events. Default is
                                       "marketplace". For blockchain you have to have access to a node that has allowed
                                       eth_getLogs call.

EXAMPLES
  $ rif-pinning daemon --strategy=blockchain --provider 'ws://localhost:8546' --ipfs '/ip4/127.0.0.1/tcp/5001' --network
  testnet

  $ rif-pinning daemon --strategy=marketplace --ipfs '/ip4/127.0.0.1/tcp/5001' --network testnet
```

### `rif-pinning db-migration`

DB migration

```
USAGE
  $ rif-pinning db-migration

OPTIONS
  -d, --db=db                          Name or path to DB file
  -d, --down                           Undo db migration
  -d, --generate=generate              Generate migrations using template [--generate=migration_name]
  -m, --migration=migration            Migration file
  -t, --to=to                          Migrate to
  -u, --up                             Migrate DB
  --config=config                      path to JSON config file to load
  --log=error|warn|info|verbose|debug  [default: error] what level of information to log
  --log-filter=log-filter              what components should be logged (+-, chars allowed)
  --log-path=log-path                  log to file, default is STDOUT
  --skipPrompt                         Answer yes for any prompting

EXAMPLES
  $ rif-pinning db --up
  $ rif-pinning db --down
  $ rif-pinning db --up --to 0-test
  $ rif-pinning db --up --migration 01-test --migration 02-test
  $ rif-pinning db --up --db ./test.sqlite --to 09-test
  $ rif-pinning db --down --db ./test.sqlite --to 09-test
  $ rif-pinning db --generate my_first_migration
```

### `rif-pinning help [COMMAND]`

display help for rif-pinning

```
USAGE
  $ rif-pinning help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.1.0/src/commands/help.ts)_

### `rif-pinning init`

Initialize Pinner service dependencies

```
USAGE
  $ rif-pinning init

OPTIONS
  -d, --db=db                          Name or path to DB file
  -o, --offerId=offerId                ID of Offer to which should the service listen to
  --config=config                      path to JSON config file to load
  --log=error|warn|info|verbose|debug  [default: error] what level of information to log
  --log-filter=log-filter              what components should be logged (+-, chars allowed)
  --log-path=log-path                  log to file, default is STDOUT
  --skipPrompt                         Answer yes for any prompting

EXAMPLES
  $ rif-pinning init
  $ rif-pinning init --offerId 0x123 --db ./relativeOrAbsolutePath/db.sqlite
  $ rif-pinning init --db fileName.sqlite
  $ rif-pinning init --db ./folder
```
<!-- commandsstop -->

### Environmental variables

Pinning service supports following environmental variables:

 - `RIFS_OFFER` (`string`) - Specifies Offer Id which the Pinning service should listen on. Same like `--offerId` flag.
 - `RIFS_DB` (`string`) - Specify the name or path to the data base file.
 - `RIFS_NETWORK` (`testnet|mainnet`) - Same like `--network` flag.
 - `RIFS_PROVIDER` (`string`) - Same like `--provider` flag.
 - `RIFS_CONFIG` (`string`) - Same like `--config` flag.
 - `RIFS_CONTRACT_ADDR` (`string`) - Specifies address of smart contract to listen the events from. Mainly for development as this is otherwise configured using `--network` flag.
 - `RIFS_IPFS` (`string`) - Same like `--ipfs` flag.
 - `LOG_LEVEL` (`string`) - Same like `--log` flag.
 - `LOG_FILTER` (`string`) - Same like `--log-filter` flag.
 - `LOG_PATH` (`string`) - Same like `--log-path` flag.

## Contribute

There are some ways you can make this module better:

- Consult our [open issues](https://github.com/rsksmart/rif-storage-pinner/issues) and take on one of them
- Help our tests reach 100% coverage!

### Development

**Requirements:**

 * IPFSv5 and higher
 * Ganache
 * Node & NPM

Please on how to set up the development environment see [Development guide](./DEVELOPMENT.md)

#### Tips

 - Using the `npm run ipfs:consumer` and `npm run ipfs:provider` you can interact with
 each IPFS node using the standard commands that IPFS supports.
 - You can interact with the CLI using `npm run bin` script from the local folder.
 - Use [RIF Communication PubSub Node](https://github.com/rsksmart/rif-communications-pubsub-node) to listen on
 the broadcast events! Only configure the correct Room's name!

## License

[MIT](./LICENSE)
