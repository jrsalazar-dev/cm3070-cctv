import { createConnection, Connection } from 'typeorm'
import { Alert } from './models/Alert'

export default class Database {
  private connection: Connection | null = null

  public async init(): Promise<Database> {
    this.connection = await createConnection({
      type: 'sqlite',
      synchronize: true,
      logging: true,
      logger: 'simple-console',
      database: 'camdb.db',
      entities: [Alert],
    })

    if (this.connection.isConnected) {
      this.connection.synchronize()
    }

    return this
  }

  public async insert(alert: Alert): Promise<Alert> {
    if (!this.connection) {
      throw new Error('No connection')
    }
    const alertRepository = this.connection.getRepository(Alert)

    return alertRepository.save(alert)
  }

  public async fetchAlerts(): Promise<Alert[]> {
    if (!this.connection) {
      throw new Error('No connection')
    }
    const alertRepository = this.connection.getRepository(Alert)

    return alertRepository.find()
  }
}
