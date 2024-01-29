export interface LiveFeed {
  id: number
  cameraIndex?: number
  url?: string
  name: string
}

export interface Alert {
  id: string
  filepath: string
  detection_time: number
  detection_objects: string
  detection_feed?: LiveFeed
  detection_status: number
}
