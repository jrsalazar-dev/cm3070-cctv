import { DeleteResult, InsertResult, UpdateResult } from 'typeorm'
import { Alert } from './database/models/Alert'
import { LiveFeed } from './database/models/LiveFeed'
import { PartialLiveFeed } from '@renderer/components/AddFeedModal'

export interface Api {
  requestDetections: () => Promise<string>
  getAlerts: () => Promise<Alert[]>
  deleteAlert: (id: string) => Promise<DeleteResult>
  deleteLiveFeed: (id: string) => Promise<DeleteResult>
  setLiveFeedAlerting: (id: number, enabled: boolean) => Promise<UpdateResult>
  setLiveFeedDetecting: (id: number, enabled: boolean) => Promise<UpdateResult>
  getLiveFeeds: () => Promise<LiveFeed[]>
  addLiveFeed: (liveFeed: PartialLiveFeed) => Promise<InsertResult>
  start: () => Promise<boolean>
}
