import {
  createConnection,
  Connection,
  DeleteResult,
  Repository,
  UpdateResult,
  InsertResult,
} from 'typeorm'
import { Alert } from './models/Alert'
import { LiveFeed } from './models/LiveFeed'

export default class Database {
  private connection: Connection | null = null

  public async init(): Promise<Database> {
    this.connection = await createConnection({
      type: 'sqlite',
      synchronize: true,
      logging: true,
      logger: 'simple-console',
      database: 'camdb.db',
      entities: [Alert, LiveFeed],
    })

    if (this.connection.isConnected) {
      this.connection.synchronize()
    }

    return this
  }

  private getAlertRepository(): Repository<Alert> {
    if (!this.connection) {
      throw new Error('No database connection')
    }
    return this.connection.getRepository(Alert)
  }

  private getLiveFeedRepository(): Repository<LiveFeed> {
    if (!this.connection) {
      throw new Error('No database connection')
    }
    return this.connection.getRepository(LiveFeed)
  }

  public async insert(alert: Alert): Promise<Alert> {
    const alertRepository = this.getAlertRepository()

    return alertRepository.save(alert)
  }

  public async deleteAlert(id: string): Promise<DeleteResult> {
    const alertRepository = this.getAlertRepository()

    return alertRepository.delete(id)
  }

  public async fetchAlerts(): Promise<Alert[]> {
    const alertRepository = this.getAlertRepository()

    return alertRepository.find({
      relations: ['detection_feed'],
    })
  }

  public async getUnalerted(): Promise<Alert[]> {
    const alertRepository = this.getAlertRepository()

    return alertRepository.find({
      take: 1,
      relations: ['detection_feed'],
      order: {
        id: 'DESC',
      },
      where: {
        detection_alerted: false,
      },
    })
  }

  public async setAlerted(id: number): Promise<UpdateResult> {
    const alertRepository = this.getAlertRepository()

    return alertRepository.update(
      {
        id,
      },
      {
        detection_alerted: true,
      },
    )
  }

  public async fetchLiveFeeds(): Promise<LiveFeed[]> {
    const liveFeedRepository = this.getLiveFeedRepository()

    return liveFeedRepository.find()
  }

  public async addLiveFeed({ name, cameraIndex, url }): Promise<InsertResult> {
    const liveFeedRepository = this.getLiveFeedRepository()

    return liveFeedRepository.insert({
      name,
      cameraIndex: cameraIndex ?? null,
      url,
    })
  }

  public async deleteLiveFeed(id: string): Promise<DeleteResult> {
    const liveFeedRepository = this.getLiveFeedRepository()

    return liveFeedRepository.delete(id)
  }

  public async setLiveFeedAlerting(id: number, enabled: boolean): Promise<UpdateResult> {
    const liveFeedRepository = this.getLiveFeedRepository()

    return liveFeedRepository.update(
      {
        id,
      },
      {
        is_alerting: enabled,
      },
    )
  }

  public async setLiveFeedDetecting(id: number, enabled: boolean): Promise<UpdateResult> {
    const liveFeedRepository = this.getLiveFeedRepository()

    return liveFeedRepository.update(
      {
        id,
      },
      {
        is_detecting: enabled,
      },
    )
  }
}
