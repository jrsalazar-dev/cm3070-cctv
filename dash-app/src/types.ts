export interface Api {
  startCamera: (url: string) => void
  startWebcam: (cam: number) => void
  requestDetections: () => Promise<string>
}
