import chai from 'chai'
import config from 'config'
import BigNumber from 'bignumber.js'
import dirtyChai from 'dirty-chai'
import chaiAsPromised from 'chai-as-promised'
import sinonChai from 'sinon-chai'
import sinon from 'sinon'
import type Sinon from 'sinon'
import { Sequelize } from 'sequelize-typescript'
import { CID, IpfsClient, multiaddr } from 'ipfs-http-client'

import { sequelizeFactory } from '../../src/sequelize'
import { FINISHED_EVENT_NAME, Job, JobsManager } from '../../src/jobs-manager'
import { randomHex } from 'web3-utils'
import { PinJob } from '../../src/providers/ipfs'
import { JobState, MessageCodesEnum } from '../../src/definitions'
import JobModel from '../../src/models/job.model'
import { runAndAwaitFirstEvent } from '../../src/utils'
import { HashExceedsSizeError } from '../../src/errors'
import * as channel from '../../src/communication'
import Agreement from '../../src/models/agreement.model'
import { mockAgreement } from '../fake-marketplace-service'
import DirectAddressModel from '../../src/models/direct-address.model'

chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.use(dirtyChai)
const expect = chai.expect

const AGREEMENT_REFERENCE = '0x123'

class StubJob extends Job {
  public stub: Sinon.SinonStub

  constructor () {
    super(`testing job ${randomHex(10)}`, AGREEMENT_REFERENCE)
    this.stub = sinon.stub()
  }

  async _run (): Promise<void> {
    await this.stub()
  }
}

describe('Jobs', function () {
  let sequelize: Sequelize
  let models: JobModel[]
  let channelSpy: Sinon.SinonSpy
  let agreement: Agreement

  before(async (): Promise<void> => {
    sequelize = await sequelizeFactory()
    await sequelize.sync({ force: true })

    agreement = new Agreement(mockAgreement({ agreementReference: AGREEMENT_REFERENCE }))
    await agreement.save()

    channelSpy = sinon.stub(channel, 'broadcast')
  })

  after(function () {
    channelSpy.restore()
  })

  describe('Job class', function () {
    beforeEach(() => {
      channelSpy.resetHistory()
    })

    it('should save entity when ran', async () => {
      const job = new StubJob()

      let promiseResolve: Function
      job.stub.returns(new Promise(resolve => { promiseResolve = resolve }))

      expect(job.name).to.eql(job.entity.name)
      expect(job.state).to.eql(JobState.CREATED)

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(0)

      const promise = runAndAwaitFirstEvent(job, FINISHED_EVENT_NAME, () => { job.run() })
        .then(async () => {
          models = await JobModel.findAll({ where: { name: job.name } })
          expect(models).to.have.length(1)
          expect(models[0].name).to.eql(job.name)
          expect(models[0].state).to.eql(JobState.FINISHED)
          expect(job.stub).to.be.calledOnce()
        })

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.RUNNING)

      promiseResolve!()

      await expect(promise).to.be.fulfilled()
    })

    it('should error out when exception is thrown', async () => {
      const job = new StubJob()
      job.stub.rejects(new Error('testing'))

      await expect(runAndAwaitFirstEvent(job, FINISHED_EVENT_NAME, () => { job.run() })).to.be.rejectedWith('testing')

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.ERRORED)
      expect(job.stub).to.be.calledOnce()
    })

    it('should mark as backedoff when retries', async () => {
      const job = new StubJob()

      await runAndAwaitFirstEvent(job, FINISHED_EVENT_NAME, () => { job.run() })

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.FINISHED)
      expect(models[0].retry).to.be.null()
      expect(job.stub).to.be.calledOnce()

      job.retry(1, 3)

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.BACKOFF)
      expect(models[0].retry).to.eql('1/3')
    })
  })

  describe('Job Manager', function () {
    beforeEach(() => {
      channelSpy.resetHistory()
    })

    it('should run a Job', async () => {
      const manager = new JobsManager()
      const job = new StubJob()

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(0)

      await manager.run(job)

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.FINISHED)
      expect(models[0].retry).to.be.null()
      expect(job.stub).to.be.calledOnce()
      expect(channelSpy).to.be.calledTwice()
      expect(channelSpy).calledWith(MessageCodesEnum.I_HASH_START, { hash: job.name, agreementReference: '0x123' })
      expect(channelSpy).calledWith(MessageCodesEnum.I_HASH_PINNED, { hash: job.name, agreementReference: '0x123' })
    })

    it('should retry failed Job', async () => {
      const manager = new JobsManager({ retries: 3 })
      const job = new StubJob()
      job.stub.onCall(0).rejects(new Error('testing'))
      job.stub.onCall(1).rejects(new Error('testing'))
      job.stub.onCall(2).resolves()

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(0)

      await manager.run(job)

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.FINISHED)
      expect(models[0].retry).to.eql('2/3')
      expect(job.stub).to.be.calledThrice()
    })

    it('should throw if all retries fails', async () => {
      const manager = new JobsManager({ retries: 3 })
      const job = new StubJob()
      job.stub.onCall(0).rejects(new Error('testing1'))
      job.stub.onCall(1).rejects(new Error('testing2'))
      job.stub.onCall(2).rejects(new Error('testing3'))

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(0)

      await expect(manager.run(job)).to.be.rejectedWith('testing3')

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.ERRORED)
      expect(models[0].retry).to.eql('2/3')
      expect(job.stub).to.be.calledThrice()
      expect(channelSpy).to.have.callCount(6)
      expect(channelSpy.getCall(0)).calledWith(MessageCodesEnum.I_HASH_START, {
        hash: job.name,
        agreementReference: '0x123'
      })
      expect(channelSpy.getCall(1)).calledWith(MessageCodesEnum.W_HASH_RETRY, {
        hash: job.name,
        retryNumber: 1,
        totalRetries: 3,
        error: 'testing1',
        agreementReference: '0x123'
      })
      expect(channelSpy.getCall(2)).calledWith(MessageCodesEnum.I_HASH_START, {
        hash: job.name,
        agreementReference: '0x123'
      })
      expect(channelSpy.getCall(3)).calledWith(MessageCodesEnum.W_HASH_RETRY, {
        hash: job.name,
        retryNumber: 2,
        totalRetries: 3,
        error: 'testing2',
        agreementReference: '0x123'
      })
      expect(channelSpy.getCall(4)).calledWith(MessageCodesEnum.I_HASH_START, {
        hash: job.name,
        agreementReference: '0x123'
      })
      expect(channelSpy.getCall(5)).calledWith(MessageCodesEnum.E_GENERAL, {
        hash: job.name,
        error: 'testing3'
      })
    })

    it('should ignore retries if NonRecoverableError', async () => {
      const manager = new JobsManager({ retries: 3 })
      const job = new StubJob()
      job.stub.onCall(0).rejects(new Error('testing1'))
      job.stub.onCall(1).rejects(new HashExceedsSizeError('testing2', new BigNumber(10), new BigNumber(9)))

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(0)

      await expect(manager.run(job)).to.be.rejectedWith('testing2')

      models = await JobModel.findAll({ where: { name: job.name } })
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.ERRORED)
      expect(models[0].retry).to.eql('1/3')
      expect(job.stub).to.be.calledTwice()
      expect(channelSpy).to.have.callCount(4)
      expect(channelSpy.getCall(0)).calledWith(MessageCodesEnum.I_HASH_START, {
        hash: job.name,
        agreementReference: '0x123'
      })
      expect(channelSpy.getCall(1)).calledWith(MessageCodesEnum.W_HASH_RETRY, {
        hash: job.name,
        retryNumber: 1,
        totalRetries: 3,
        error: 'testing1',
        agreementReference: '0x123'
      })
      expect(channelSpy.getCall(2)).calledWith(MessageCodesEnum.I_HASH_START, {
        hash: job.name,
        agreementReference: '0x123'
      })

      expect(channelSpy.getCall(3)).calledWith(MessageCodesEnum.E_AGREEMENT_SIZE_LIMIT_EXCEEDED, {
        hash: job.name,
        size: new BigNumber(10),
        expectedSize: new BigNumber(9),
        agreementReference: '0x123'
      })
    })
  })

  describe('Pinning Job', function () {
    const fakeAgreementReference = 'fakeReference'
    const fakePeerId = 'QmV52RowihjoLGa4bAbYfFSMaXB6neuqCPZsZtvZjZ7xL7'
    const fakeHash = '/ipfs/QmV52RowihjoLGa4bAbYfFSMaXB6neuqCPZsZtvZjZ7xL7'
    const fakeSize = new BigNumber(10)
    const fakeNodeAddress = '/ip4/127.0.0.1/tcp/4002'
    const fakeAddresses = [multiaddr(fakeNodeAddress + '/p2p/' + fakePeerId)]
    const ipfsStub = {
      object: { stat: sinon.stub() },
      pin: { add: sinon.stub() },
      dht: { findPeer: sinon.stub() },
      swarm: {
        connect: sinon.stub(),
        disconnect: sinon.stub()
      }
    }

    beforeEach(async () => {
      await sequelize.sync({ force: true })
      channelSpy.resetHistory()
      ipfsStub.object.stat.returns({ CumulativeSize: 1 })
      ipfsStub.pin.add.returns(Promise.resolve())
      ipfsStub.dht.findPeer.returns({ id: fakePeerId, addrs: [multiaddr(fakeNodeAddress)] })
      ipfsStub.swarm.connect.returns(Promise.resolve())
      ipfsStub.swarm.disconnect.returns(Promise.resolve())
    })
    afterEach(() => {
      ipfsStub.object.stat.reset()
      ipfsStub.pin.add.reset()
      ipfsStub.dht.findPeer.reset()
      ipfsStub.swarm.connect.reset()
      ipfsStub.swarm.disconnect.reset()
    })

    it('call swarm connect -> pin -> swarm disconnect', async () => {
      const hash = fakeHash.replace('/ipfs/', '')
      await DirectAddressModel.create({ agreementReference: fakeAgreementReference, peerId: fakePeerId })

      const job = new PinJob(ipfsStub as unknown as IpfsClient, fakeHash, fakeSize, fakeAgreementReference)
      await job._run()

      expect(ipfsStub.object.stat.calledWith(new CID(hash), { timeout: config.get<number | string>('ipfs.sizeFetchTimeout') })).to.be.true()
      expect(ipfsStub.dht.findPeer.calledWith(new CID(fakePeerId))).to.be.true()
      expect(ipfsStub.swarm.connect.calledWith(fakeAddresses)).to.be.true()
      expect(ipfsStub.pin.add.calledWith(new CID(hash))).to.be.true()
      expect(ipfsStub.swarm.connect.calledWith(fakeAddresses)).to.be.true()
    })
    it('size exceed error', async () => {
      ipfsStub.object.stat.returns({ CumulativeSize: 10000000000000 })

      const job = new PinJob(ipfsStub as unknown as IpfsClient, fakeHash, fakeSize, fakeAgreementReference)

      await expect(job._run()).eventually.be.rejectedWith(
        HashExceedsSizeError,
        'The hash exceeds payed size!'
      )
      expect(ipfsStub.pin.add.called).to.be.false()
      expect(ipfsStub.dht.findPeer.called).to.be.false()
      expect(ipfsStub.swarm.connect.called).to.be.false()
      expect(ipfsStub.swarm.disconnect.called).to.be.false()
    })
  })
})
