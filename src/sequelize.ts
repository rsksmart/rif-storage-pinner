import { DataType, Model, Sequelize, SequelizeOptions } from 'sequelize-typescript'
import { ModelAttributeColumnOptions } from 'sequelize'
import path from 'path'
import sqlFormatter from 'sql-formatter'
import fs from 'fs'
import config from 'config'
import BigNumber from 'bignumber.js'

import { loggingFactory } from './logger'
import { bn } from './utils'

const logger = loggingFactory('db')

function formatLogs (msg: string): string {
  const result = msg.match(/^Executing \(([\w\d-]+)\): (.*)/m)

  if (!result) {
    return msg
  }

  return `Executing SQL (${result[1]}):\n${sqlFormatter.format(result[2])}`
}

export function sequelizeFactory (dbPath?: string): Sequelize {
  dbPath = dbPath ?? config.get<string>('db')

  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const dbSettings: SequelizeOptions = {
    models: [path.join(__dirname, '/**/*.model.+(ts|js)')],
    modelMatch: (filename: string, member: string): boolean => {
      return filename.substring(0, filename.indexOf('.model')) === member.toLowerCase()
    },
    logging: (msg) => logger.debug(formatLogs(msg)),
    // @ts-ignore
    transactionType: 'IMMEDIATE'
  }

  const sequelize = new Sequelize(`sqlite:${dbPath}`, dbSettings)

  // Set up data relationships
  const models = sequelize.models
  Object.keys(models).forEach(name => {
    if ('associate' in models[name]) {
      (models[name] as any).associate(models)
    }
  })

  return sequelize
}

type BigNumberStringTypeMeta = { propName: string, model?: string }
export function BigNumberStringType (meta: BigNumberStringTypeMeta): Partial<ModelAttributeColumnOptions> {
  return {
    type: DataType.STRING(),
    get (this: Model): BigNumber {
      return bn(this.getDataValue(meta.propName))
    },
    set (this: Model, value: string | number | BigNumber): void {
      const n = bn(value)

      if (isNaN(n.toNumber())) {
        throw new Error(`${meta?.model + ' ' || ''}Model Error: ${meta?.propName} should be a one of [number, string(number), BigNumber]`)
      }
      this.setDataValue(meta.propName, bn(value).toString(10))
    }
  }
}
