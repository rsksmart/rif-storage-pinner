import chai from 'chai'
import sinon from 'sinon'
import dirtyChai from 'dirty-chai'
import { IConfig } from '@oclif/config'
import chaiAsPromised from 'chai-as-promised'
import sinonChai from 'sinon-chai'

import BaseCommand from '../../src/utils'
import * as sequalize from '../../src/sequelize'
import * as store from '../../src/store'

chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.use(dirtyChai)
const expect = chai.expect

class BaseCommandMock extends BaseCommand {
  get getIsDbInitialized (): boolean { return this.isDbInitialized }
  get getInitDB () { return this.initDB }
  run (): PromiseLike<any> {
    return Promise.resolve(undefined)
  }
}

const getBaseCommandMock = () => new BaseCommandMock([], {} as IConfig)

describe('CLI', function () {
  describe('BaseCommand', () => {
    let baseCommand = getBaseCommandMock()

    afterEach(() => {
      sinon.reset()
      baseCommand = getBaseCommandMock()
    })

    describe('init DB', () => {
      const syncSpy: sinon.SinonSpy = sinon.spy()
      let sequalizeStub: any
      let sequelizeFactoryStub: sinon.SinonStub
      let initStoreStub: sinon.SinonStub

      beforeEach(() => {
        baseCommand = getBaseCommandMock()
        sequalizeStub = { sync: syncSpy } as any
        sequelizeFactoryStub = sinon.stub(sequalize, 'sequelizeFactory').returns(Promise.resolve(sequalizeStub))
        initStoreStub = sinon.stub(store, 'initStore').returns(Promise.resolve())
      })
      afterEach(() => {
        syncSpy.resetHistory()
        sequelizeFactoryStub.restore()
        initStoreStub.restore()
      })

      it('should init DB: sync true', async () => {
        expect(baseCommand.getIsDbInitialized).to.be.false()

        await baseCommand.getInitDB('path1', true)

        expect(sequelizeFactoryStub.calledOnce).to.be.true()
        expect(sequelizeFactoryStub.calledOnceWith('path1')).to.be.true()
        expect(initStoreStub.calledOnceWith(sequalizeStub)).to.be.true()
        expect(syncSpy.calledOnce).to.be.true()
        expect(baseCommand.getIsDbInitialized).to.be.true()
      })
      it('should init DB: sync false', async () => {
        expect(baseCommand.getIsDbInitialized).to.be.false()

        await baseCommand.getInitDB('path', false)

        expect(sequelizeFactoryStub.calledOnce).to.be.true()
        expect(sequelizeFactoryStub.calledOnceWith('path')).to.be.true()
        expect(initStoreStub.calledOnceWith(sequalizeStub)).to.be.true()
        expect(syncSpy.calledOnce).to.be.false()
        expect(baseCommand.getIsDbInitialized).to.be.true()
      })
    })
  })
})
