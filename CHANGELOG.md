<a name="0.1.0-pre.3"></a>
# [0.1.0-pre.3](https://github.com/rsksmart/rds-ipfs/compare/v0.1.0-pre.2...v0.1.0-pre.3) (2020-08-28)


### Features

* communication integration ([#159](https://github.com/rsksmart/rds-ipfs/issues/159)) ([8635d09](https://github.com/rsksmart/rds-ipfs/commit/8635d09))
* direct swarming ([#185](https://github.com/rsksmart/rds-ipfs/issues/185)) ([5590697](https://github.com/rsksmart/rds-ipfs/commit/5590697))
* marketplace strategy reorgs handling ([#162](https://github.com/rsksmart/rds-ipfs/issues/162)) ([9002fc4](https://github.com/rsksmart/rds-ipfs/commit/9002fc4))



<a name="0.1.0-pre.2"></a>
# [0.1.0-pre.2](https://github.com/rsksmart/rds-ipfs/compare/v0.1.0-pre.1...v0.1.0-pre.2) (2020-08-21)


### Bug Fixes

* migrate also js migrations ([553560b](https://github.com/rsksmart/rds-ipfs/commit/553560b))



<a name="0.1.0-pre.1"></a>
# [0.1.0-pre.1](https://github.com/rsksmart/rds-ipfs/compare/v0.1.0-pre.0...v0.1.0-pre.1) (2020-08-21)



<a name="0.1.0-pre.0"></a>
# [0.1.0-pre.0](https://github.com/rsksmart/rds-ipfs/compare/v0.0.1...v0.1.0-pre.0) (2020-08-21)


### Bug Fixes

* custom typings for config ([25dba5d](https://github.com/rsksmart/rds-ipfs/commit/25dba5d))
* db migration improvements ([#172](https://github.com/rsksmart/rds-ipfs/issues/172)) ([f94f813](https://github.com/rsksmart/rds-ipfs/commit/f94f813))
* development setting of ipfs ([3aa3da9](https://github.com/rsksmart/rds-ipfs/commit/3aa3da9))
* drop sync() as migrations are used now ([4b8019e](https://github.com/rsksmart/rds-ipfs/commit/4b8019e))
* handle non existing pin ([be9ec7c](https://github.com/rsksmart/rds-ipfs/commit/be9ec7c))
* ignore development config in npm package run ([6de33c8](https://github.com/rsksmart/rds-ipfs/commit/6de33c8))
* make pin/unpin after create/update agreement ([194e7fc](https://github.com/rsksmart/rds-ipfs/commit/194e7fc))
* no pinning in processor on blockchain precache ([2d13336](https://github.com/rsksmart/rds-ipfs/commit/2d13336))


### Features

* add initial db migration file ([#175](https://github.com/rsksmart/rds-ipfs/issues/175)) ([05c9d59](https://github.com/rsksmart/rds-ipfs/commit/05c9d59))
* add strategy flag to cli ([37d8b03](https://github.com/rsksmart/rds-ipfs/commit/37d8b03))
* allow configure topics ([#130](https://github.com/rsksmart/rds-ipfs/issues/130)) ([06b457c](https://github.com/rsksmart/rds-ipfs/commit/06b457c))
* basic communication interface ([d9fd1fe](https://github.com/rsksmart/rds-ipfs/commit/d9fd1fe))
* bignumber support ([#158](https://github.com/rsksmart/rds-ipfs/issues/158)) ([e04548a](https://github.com/rsksmart/rds-ipfs/commit/e04548a))
* cache events ([#92](https://github.com/rsksmart/rds-ipfs/issues/92)) ([ce994d2](https://github.com/rsksmart/rds-ipfs/commit/ce994d2))
* change size measurement from bytes to megabytes ([#160](https://github.com/rsksmart/rds-ipfs/issues/160)) ([a977356](https://github.com/rsksmart/rds-ipfs/commit/a977356))
* cli agreements ([#137](https://github.com/rsksmart/rds-ipfs/issues/137)) ([f124087](https://github.com/rsksmart/rds-ipfs/commit/f124087))
* db migrations ([#141](https://github.com/rsksmart/rds-ipfs/issues/141)) ([4226c0b](https://github.com/rsksmart/rds-ipfs/commit/4226c0b))
* extend CLI ([#127](https://github.com/rsksmart/rds-ipfs/issues/127)) ([2f164f7](https://github.com/rsksmart/rds-ipfs/commit/2f164f7))
* gc using marketplace-cache-service events ([#113](https://github.com/rsksmart/rds-ipfs/issues/113)) ([1082597](https://github.com/rsksmart/rds-ipfs/commit/1082597))
* handling reorgs for blockchain provider ([#133](https://github.com/rsksmart/rds-ipfs/issues/133)) ([c12124f](https://github.com/rsksmart/rds-ipfs/commit/c12124f))
* networkId check ([#132](https://github.com/rsksmart/rds-ipfs/issues/132)) ([f5d30a2](https://github.com/rsksmart/rds-ipfs/commit/f5d30a2))
* pinning jobs manager ([b901f4a](https://github.com/rsksmart/rds-ipfs/commit/b901f4a))
* status reporting ([#144](https://github.com/rsksmart/rds-ipfs/issues/144)) ([1f9cc12](https://github.com/rsksmart/rds-ipfs/commit/1f9cc12))



<a name="0.0.1"></a>
## [0.0.1](https://github.com/rsksmart/rds-ipfs/compare/e53decf...v0.0.1) (2020-07-23)


### Bug Fixes

* gc review agreements before unpin ([e386286](https://github.com/rsksmart/rds-ipfs/commit/e386286))
* reorgs should not reprocess last processed block ([83c4e2a](https://github.com/rsksmart/rds-ipfs/commit/83c4e2a))
* use system persistent folder for data storage ([0ae5334](https://github.com/rsksmart/rds-ipfs/commit/0ae5334))
* web3js default exports problem ([1d9fffa](https://github.com/rsksmart/rds-ipfs/commit/1d9fffa))


### Features

* agreement support ([44fdf27](https://github.com/rsksmart/rds-ipfs/commit/44fdf27))
* basic cli to interact with pinning contract ([d19711a](https://github.com/rsksmart/rds-ipfs/commit/d19711a))
* basic pinning ([a0a1cd6](https://github.com/rsksmart/rds-ipfs/commit/a0a1cd6))
* basic setup for event listening ([3ffc4f8](https://github.com/rsksmart/rds-ipfs/commit/3ffc4f8))
* basic timeout support ([3d4eddf](https://github.com/rsksmart/rds-ipfs/commit/3d4eddf))
* building state from blockchain ([6b64e80](https://github.com/rsksmart/rds-ipfs/commit/6b64e80))
* contracts as package ([e53decf](https://github.com/rsksmart/rds-ipfs/commit/e53decf))
* integration test ([#85](https://github.com/rsksmart/rds-ipfs/issues/85)) ([ec29fed](https://github.com/rsksmart/rds-ipfs/commit/ec29fed))
* pinning gc ([#81](https://github.com/rsksmart/rds-ipfs/issues/81)) ([3a54fe7](https://github.com/rsksmart/rds-ipfs/commit/3a54fe7))
* support for cancelling offer ([a48589f](https://github.com/rsksmart/rds-ipfs/commit/a48589f))



