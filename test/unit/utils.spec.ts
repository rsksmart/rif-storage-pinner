import chai from 'chai'
import dirtyChai from 'dirty-chai'

import { prefixArray, encodeHash } from '../utils'

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
})
