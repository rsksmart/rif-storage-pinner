import chai from 'chai'
import BigNumber from 'bignumber.js'
import sinonChai from 'sinon-chai'
import Sequelize from 'sequelize'

import { sequelizeFactory } from '../../src/sequelize'
import Agreement from '../../src/models/agreement.model'

chai.use(sinonChai)
const expect = chai.expect

const generateModelGettersTests = (
  schema: Array<{ fn: string, cases: Array<any> }>,
  modelFactory: (arg: Record<string, unknown>) => Sequelize.Model,
  options?: { skip: string[] }
) => schema.forEach(
  ({ fn, cases }) =>
    !(options?.skip || []).includes(fn) && describe(`should properly calculate ${fn}`,
      () => cases.forEach(([arg, exp]) => {
        it(`${fn} for ${JSON.stringify(arg)} should be ${exp}`,
          () => {
            const model = modelFactory(arg)
            expect((model as { [key: string]: any })[fn]).to.be.eql(exp)
          }
        )
      })
    )
)

const hour = 1000 * 60 * 60
const day = hour * 24
const month = day * 30
const toSecond = (mili: number) => mili / 1000

const agreementFactory = (arg: Record<string, unknown>) => new Agreement({
  agreementReference: 'ref',
  dataReference: 'dataRef',
  consumer: 'Creator',
  offerId: 'Offer',
  size: 1,
  billingPeriod: 1,
  billingPrice: 100,
  availableFunds: 100,
  lastPayout: new Date(),
  ...arg
})

const AGREEMENT_TEST_SCHEMA = [
  {
    fn: 'numberOfPrepaidPeriods',
    cases: [
      [{ billingPrice: 10, size: 1, availableFunds: 10 }, new BigNumber(1)],
      [{ billingPrice: 100, size: 2, availableFunds: 100 }, new BigNumber(0)],
      [{ billingPrice: 1, size: 5, availableFunds: 10 }, new BigNumber(2)],
      [{ billingPrice: 1, size: 10, availableFunds: 1000 }, new BigNumber(100)],
      [{ billingPrice: 102222, size: 1, availableFunds: 10 }, new BigNumber(0)]
    ]
  },
  {
    fn: 'periodsSinceLastPayout',
    cases: [
      [{ billingPeriod: toSecond(hour), lastPayout: new Date(Date.now() - day) }, new BigNumber(24)],
      [{ billingPeriod: toSecond(hour), lastPayout: new Date(Date.now() - hour) }, new BigNumber(1)],
      [{ billingPeriod: toSecond(hour), lastPayout: new Date(Date.now() - hour * 4) }, new BigNumber(4)],
      [{ billingPeriod: toSecond(hour), lastPayout: new Date(Date.now()) }, new BigNumber(0)],
      [{ billingPeriod: toSecond(day), lastPayout: new Date(Date.now() - day) }, new BigNumber(1)],
      [{ billingPeriod: toSecond(2 * day), lastPayout: new Date(Date.now() - 2 * day) }, new BigNumber(1)],
      [{ billingPeriod: toSecond(2 * day), lastPayout: new Date(Date.now() - 4 * day) }, new BigNumber(2)],
      [{ billingPeriod: toSecond(month), lastPayout: new Date(Date.now() - 4 * month) }, new BigNumber(4)]
    ]
  },
  {
    fn: 'toBePayedOut',
    cases: [
      [
        {
          availableFunds: 100,
          size: 1,
          billingPrice: 2,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - day)
        },
        new BigNumber(48)
      ],
      [
        {
          availableFunds: 47,
          size: 1,
          billingPrice: 2,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - day)
        },
        new BigNumber(47)
      ],
      [
        {
          availableFunds: 100,
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - day)
        },
        new BigNumber(100)
      ],
      [
        {
          availableFunds: 2400,
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - day)
        },
        new BigNumber(2400)
      ],
      [
        {
          availableFunds: 2400,
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(month),
          lastPayout: new Date(Date.now() - 4 * month)
        },
        new BigNumber(400)
      ]
    ]
  },
  {
    fn: 'hasSufficientFunds',
    cases: [
      [
        {
          availableFunds: 100,
          size: 1,
          billingPrice: 2,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - day)
        },
        true
      ],
      [
        {
          availableFunds: 47,
          size: 1,
          billingPrice: 2,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - day)
        },
        false
      ],
      [
        {
          availableFunds: 49,
          size: 1,
          billingPrice: 2,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - day)
        },
        false
      ],
      [
        {
          availableFunds: 100,
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - day)
        },
        false
      ],
      [
        {
          availableFunds: 2400,
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - day)
        },
        false
      ],
      [
        {
          availableFunds: 2400,
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(month),
          lastPayout: new Date(Date.now() - 4 * month)
        },
        true
      ]
    ]
  },
  {
    fn: 'expiresIn',
    cases: [
      [
        {
          availableFunds: 100, // Not enough for period
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - day)
        },
        new BigNumber(0)
      ],
      [
        {
          availableFunds: 2500, // enough for 1 period
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - day)
        },
        new BigNumber(3600)
      ],
      [
        {
          availableFunds: 250, // enough for half period
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - 2 * hour)
        },
        new BigNumber(0)
      ],
      [
        {
          availableFunds: 400, // enough for 2 periods
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - 2 * hour)
        },
        new BigNumber(7200)
      ],
      [
        {
          availableFunds: 400, // enough for 2 periods
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - 2.5 * hour)
        },
        new BigNumber(1.5 * 3600)
      ],
      [
        {
          availableFunds: 100, // has for one period
          size: 10,
          billingPrice: 10,
          billingPeriod: toSecond(hour),
          lastPayout: new Date(Date.now() - 0.7 * hour) // period already started and has 0.3 hour left
        },
        new BigNumber(3600 * 0.3)
      ]
    ]
  }
]
describe('Models', () => {
  before(() => sequelizeFactory())
  describe('Agreement', () => generateModelGettersTests(AGREEMENT_TEST_SCHEMA, agreementFactory))
})
