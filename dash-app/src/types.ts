import { Alert } from './database/models/Alert'

export interface Api {
  startCamera: (url: string) => void
  startWebcam: (cam: number) => void
  requestDetections: () => Promise<string>
  getAlerts: () => Promise<Alert[]>
}
