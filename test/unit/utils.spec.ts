import chai from 'chai'
import dirtyChai from 'dirty-chai'
import BigNumber from 'bignumber.js'

import { prefixArray, encodeHash } from '../utils'
import { BytesInMb, bytesToMegabytes } from '../../src/utils'

chai.use(dirtyChai)
const expect = chai.expect

describe('Utils', function () {
  describe('encodeHash', function () {
    it('should split longer hash then 32 chars into chanks', () => {
      expect(encodeHash('qwertyuiopqwertyuiopwertyuiopqwetyuiopwertyuiopqwe')).to.eql([
        '0x71776572747975696f7071776572747975696f70776572747975696f70717765',
        '0x747975696f70776572747975696f707177650000000000000000000000000000'
      ])
    })
  })
  describe('prefixByte32Array', () => {
    it('should prefix normal 32 length array', () => {
      expect(prefixArray(['11111111111111111111111111222222', '33333333333333333333333333444444'], 'prefix')).to.eql([
        'prefix11111111111111111111111111',
        '22222233333333333333333333333333',
        '444444'
      ])
    })
    it('should prefix diff sized normal 32 length array', () => {
      expect(prefixArray(['11111111111111111111111111222222', '11111111111111111111111111'], 'prefix')).to.eql([
        'prefix11111111111111111111111111',
        '22222211111111111111111111111111'
      ])
    })
    it('should prefix empty array', () => {
      expect(prefixArray([], 'prefix')).to.eql(['prefix'])
    })
    it('should reject too long prefix', () => {
      expect(() => prefixArray([], 'qwertyuiopqwertyuiopwertyuiopqwertyuiop')).to.throw('Too long prefix! Max 32 chars!')
    })
    it('should reject when element is too long', () => {
      expect(() => prefixArray(['qwertyuiopqwertyuiopwertyuiopqwertyuiop'], 'prefix')).to.throw('Element 0 was longer then expected!')
    })
  })
  describe('bytesToMb', () => {
    const cases: Array<[number | string | BigNumber, BigNumber]> = [
      [BytesInMb, new BigNumber(1)],
      [BytesInMb * 3, new BigNumber(3)],
      [`${BytesInMb * 2}`, new BigNumber(2)],
      [new BigNumber(BytesInMb * 0.5), new BigNumber(0.5)],
      [new BigNumber(BytesInMb * 100), new BigNumber(100)],
      [BytesInMb * 2.3, new BigNumber(2.3)],
      [BytesInMb * 0.1, new BigNumber(0.1)],
      [new BigNumber(BytesInMb * 250), new BigNumber(250)]
    ]
    cases.forEach(
      ([argument, expected]) => {
        it(`${argument.toString()} bytes should be ${expected.toString()} MB`, () => {
          expect(bytesToMegabytes(argument)).to.be.eql(expected)
        })
      }
    )
  })
})
