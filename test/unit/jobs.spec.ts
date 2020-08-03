import chai from 'chai'
import dirtyChai from 'dirty-chai'
import chaiAsPromised from 'chai-as-promised'
import sinonChai from 'sinon-chai'
import sinon from 'sinon'
import type Sinon from 'sinon'
import { Sequelize } from 'sequelize-typescript'

import { sequelizeFactory } from '../../src/sequelize'
import { FINISHED_EVENT_NAME, Job, JobsManager } from '../../src/jobs-manager'
import { randomHex } from 'web3-utils'
import { JobState } from '../../src/definitions'
import JobModel from '../../src/models/job.model'
import { runAndAwaitFirstEvent } from '../../src/utils'
import { NonRecoverableError } from '../../src/errors'

chai.use(sinonChai)
chai.use(chaiAsPromised)
chai.use(dirtyChai)
const expect = chai.expect

class StubJob extends Job {
  public stub: Sinon.SinonStub

  constructor () {
    super(`testing job ${randomHex(10)}`)
    this.stub = sinon.stub()
  }

  async _run (): Promise<void> {
    await this.stub()
  }
}

describe('Jobs', function () {
  let sequelize: Sequelize
  let models: JobModel[]

  before(async (): Promise<void> => {
    sequelize = await sequelizeFactory()
  })

  describe('Job class', function () {
    beforeEach(async () => {
      await sequelize.sync({ force: true })
    })

    it('should save entity when ran', async () => {
      const job = new StubJob()

      let promiseResolve: Function
      job.stub.returns(new Promise(resolve => { promiseResolve = resolve }))

      expect(job.name).to.eql(job.entity.name)
      expect(job.state).to.eql(JobState.CREATED)

      models = await JobModel.findAll()
      expect(models).to.have.length(0)

      const promise = runAndAwaitFirstEvent(job, FINISHED_EVENT_NAME, () => { job.run() })
        .then(async () => {
          models = await JobModel.findAll()
          expect(models).to.have.length(1)
          expect(models[0].name).to.eql(job.name)
          expect(models[0].state).to.eql(JobState.FINISHED)
          expect(job.stub).to.be.calledOnce()
        })

      models = await JobModel.findAll()
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

      models = await JobModel.findAll()
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.ERRORED)
      expect(job.stub).to.be.calledOnce()
    })

    it('should mark as backedoff when retries', async () => {
      const job = new StubJob()

      await runAndAwaitFirstEvent(job, FINISHED_EVENT_NAME, () => { job.run() })

      models = await JobModel.findAll()
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.FINISHED)
      expect(models[0].retry).to.be.null()
      expect(job.stub).to.be.calledOnce()

      job.retry(1, 3)

      models = await JobModel.findAll()
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.BACKOFF)
      expect(models[0].retry).to.eql('1/3')
    })
  })

  describe('Job Manager', function () {
    beforeEach(async () => {
      await sequelize.sync({ force: true })
    })

    it('should run a Job', async () => {
      const manager = new JobsManager()
      const job = new StubJob()

      models = await JobModel.findAll()
      expect(models).to.have.length(0)

      await manager.run(job)

      models = await JobModel.findAll()
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.FINISHED)
      expect(models[0].retry).to.be.null()
      expect(job.stub).to.be.calledOnce()
    })

    it('should retry failed Job', async () => {
      const manager = new JobsManager({ retries: 3 })
      const job = new StubJob()
      job.stub.onCall(0).rejects(new Error('testing'))
      job.stub.onCall(1).rejects(new Error('testing'))
      job.stub.onCall(2).resolves()

      models = await JobModel.findAll()
      expect(models).to.have.length(0)

      await manager.run(job)

      models = await JobModel.findAll()
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

      models = await JobModel.findAll()
      expect(models).to.have.length(0)

      await expect(manager.run(job)).to.be.rejectedWith('testing3')

      models = await JobModel.findAll()
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.ERRORED)
      expect(models[0].retry).to.eql('2/3')
      expect(job.stub).to.be.calledThrice()
    })

    it('should ignore retries if NonRecoverableError', async () => {
      const manager = new JobsManager({ retries: 3 })
      const job = new StubJob()
      job.stub.onCall(0).rejects(new Error('testing1'))
      job.stub.onCall(1).rejects(new NonRecoverableError('testing2'))

      models = await JobModel.findAll()
      expect(models).to.have.length(0)

      await expect(manager.run(job)).to.be.rejectedWith('testing2')

      models = await JobModel.findAll()
      expect(models).to.have.length(1)
      expect(models[0].name).to.eql(job.name)
      expect(models[0].state).to.eql(JobState.ERRORED)
      expect(models[0].retry).to.eql('1/3')
      expect(job.stub).to.be.calledTwice()
    })
  })
})
