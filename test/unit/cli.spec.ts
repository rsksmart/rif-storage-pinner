import config from 'config'
import chai from 'chai'
import fs from 'fs'
import sinon from 'sinon'
import dirtyChai from 'dirty-chai'
import { IConfig } from '@oclif/config'
import chaiAsPromised from 'chai-as-promised'
import sinonChai from 'sinon-chai'

import BaseCommand from '../../src/utils'
import * as sequalize from '../../src/sequelize'
import * as store from '../../src/store'
import { InitCommandOption } from '../../src/definitions'

chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.use(dirtyChai)
const expect = chai.expect

const DATA_DIR = 'dataDir'
class BaseCommandMock extends BaseCommand {
  config: IConfig = { dataDir: DATA_DIR } as IConfig
  setInitOptions (options: InitCommandOption) { this.initOptions = { ...this.defaultInitOptions, ...options } }
  get getIsDbInitialized (): boolean { return this.isDbInitialized }
  get getInitDB () { return this.initDB }
  get getInitCommand () { return this.init }
  get getResolveDbPath () { return this.resolveDbPath }
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

    describe('initDB', () => {
      const syncSpy: sinon.SinonSpy = sinon.spy()
      let sequalizeStub: any
      let sequelizeFactoryStub: sinon.SinonStub
      let initStoreStub: sinon.SinonStub

      beforeEach(() => {
        baseCommand = getBaseCommandMock()
        sequalizeStub = { sync: syncSpy } as any
        sequelizeFactoryStub = sinon.stub(sequalize, 'sequelizeFactory').returns(sequalizeStub)
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

    describe('resolvePath', () => {
      const TEST_CASES = [
        // File name
        { db: 'someDbName', resolved: `${process.cwd()}/${DATA_DIR}/someDbName.sqlite` },
        { db: 'someDbName.sqlite', resolved: `${process.cwd()}/${DATA_DIR}/someDbName.sqlite` },
        // Get from config
        { db: '', resolved: `${process.cwd()}/${DATA_DIR}/${config.get('db')}` },
        // Absolute or relative path
        { db: './someFolder/test', resolved: `${process.cwd()}/someFolder/test.sqlite` },
        { db: './someFolder/test.sqlite', resolved: `${process.cwd()}/someFolder/test.sqlite` },
        { db: '/absolutePath/test', resolved: '/absolutePath/test.sqlite' },
        { db: '/absolutePath/test.sqlite', resolved: '/absolutePath/test.sqlite' },
        { db: '/absolutePath', resolved: '/absolutePath.sqlite' },
        { db: '/absolutePath/', rejected: 'Path should include the file name' }
      ]

      TEST_CASES.forEach(({ db, resolved, rejected }) => {
        it(`should resolve ${db ? 'path for --db ' + db : 'from config'}`, () => {
          if (resolved) {
            expect(baseCommand.getResolveDbPath(db)).to.be.eql(resolved)
          } else {
            expect(() => baseCommand.getResolveDbPath(db)).to.throw(rejected)
          }
        })
      })
    })

    describe('initCommand', () => {
      const db = 'test'
      const flags = { db }
      const dbPath = 'testPath'
      const fakeCommand = 'FakeCommand'

      const initDbStub: sinon.SinonStub = sinon.stub()
      const parseWithPromptStub: sinon.SinonStub = sinon.stub()
      const baseConfigStub: sinon.SinonStub = sinon.stub()
      const resolveDbPath: sinon.SinonStub = sinon.stub()
      let fsExistStub: sinon.SinonStub

      beforeEach(() => {
        baseCommand = getBaseCommandMock()
        baseCommand['initDB'] = initDbStub
        baseCommand['resolveDbPath'] = resolveDbPath.returns('testPath')
        baseCommand['parseWithPrompt'] = parseWithPromptStub.returns({ flags })
        baseCommand['baseConfig'] = baseConfigStub.returns(true)
        fsExistStub = sinon.stub(fs, 'existsSync').returns(true)
      })

      afterEach(() => {
        initDbStub.reset()
        parseWithPromptStub.reset()
        baseConfigStub.reset()
        resolveDbPath.reset()
        fsExistStub.restore()
      })

      const baseCheck = (baseCommand: BaseCommandMock) => {
        expect(baseCommand['dbPath']).to.be.eql(dbPath)
        expect(baseCommand['parsedArgs']).to.be.eql({ flags })
        expect(parseWithPromptStub.calledOnceWith(baseCommand.constructor)).to.be.true()
        expect(resolveDbPath.calledOnceWith(db)).to.be.true()
      }

      it('init command: default options', async () => {
        await baseCommand.getInitCommand()

        baseCheck(baseCommand)

        expect(baseConfigStub.calledOnceWith(flags)).to.be.true()
        expect(fsExistStub.calledOnce).to.be.true()
        expect(initDbStub.calledOnceWith(dbPath, false)).to.be.true()
      })

      it('init command: { db: false }', async () => {
        baseCommand.setInitOptions({ db: false })
        await baseCommand.getInitCommand()

        baseCheck(baseCommand)

        expect(baseConfigStub.calledOnceWith(flags)).to.be.true()
        expect(fsExistStub.calledOnce).to.be.true()
        expect(initDbStub.called).to.be.false()
      })

      it('init command: { baseConfig: false }', async () => {
        baseCommand.setInitOptions({ baseConfig: false })
        await baseCommand.getInitCommand()

        baseCheck(baseCommand)

        expect(baseConfigStub.called).to.be.false()
        expect(fsExistStub.calledOnce).to.be.true()
        expect(initDbStub.called).to.be.true()
      })

      it('init command: { serviceRequired: false }', async () => {
        baseCommand.setInitOptions({ serviceRequired: false })
        await baseCommand.getInitCommand()

        baseCheck(baseCommand)

        expect(baseConfigStub.called).to.be.true()
        expect(fsExistStub.called).to.be.false()
        expect(initDbStub.called).to.be.true()
      })

      it('init command: { serviceRequired: true }, db file not found', async () => {
        fsExistStub.restore()
        fsExistStub = sinon.stub(fs, 'existsSync').returns(false)
        baseCommand.setInitOptions({ serviceRequired: true })

        await expect(baseCommand.getInitCommand()).to.eventually.be.rejectedWith(
          Error,
          'Service was not yet initialized, first run \'init\' command!'
        )

        baseCheck(baseCommand)

        expect(baseConfigStub.called).to.be.true()
        expect(fsExistStub.called).to.be.true()
        expect(initDbStub.called).to.be.false()
      })
    })
  })
})
