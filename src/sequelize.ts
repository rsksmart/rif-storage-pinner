import { Sequelize, SequelizeOptions } from 'sequelize-typescript'
import path from 'path'
import sqlFormatter from 'sql-formatter'
import { promises as fs } from 'fs'
import config from 'config'

import { loggingFactory } from './logger'

const logger = loggingFactory('db')

function formatLogs (msg: string): string {
  const result = msg.match(/^Executing \(([\w\d-]+)\): (.*)/m)

  if (!result) {
    return msg
  }

  return `Executing SQL (${result[1]}):\n${sqlFormatter.format(result[2])}`
}

export async function sequelizeFactory (dbPath?: string): Promise<Sequelize> {
  dbPath = dbPath ?? config.get<string>('db')

  await fs.mkdir(path.dirname(dbPath), { recursive: true })
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

  await sequelize.sync()
  return sequelize
}
