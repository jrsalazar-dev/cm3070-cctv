import type { Api } from '../../../types'
import { type Component, createResource, createSignal, Show, createEffect } from 'solid-js'
import { io } from 'socket.io-client'
import { Header } from '@renderer/components/Header'

let peerConnection: RTCPeerConnection
const config = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302'],
    },
  ],
}

const api = window.api as Api

let watcher: string
export const Live: Component = () => {
  const socket = io('http://localhost:3000')
  const [detections] = createResource<string[]>(async () => {
    return (await api.requestDetections()).split(',')
  })

  const [watching, setWatching] = createSignal({
    peerId: '',
    detection: '',
  })

  socket.on('connect', () => {
    socket.emit('broadcaster', socket.id)
    console.log('connected with id', socket.id)

    if (detections()) {
      console.log('emitting detections', detections())
      socket.emit('detections', detections())
    }

    socket.on('watch', (id, detection) => {
      setWatching({
        detection,
        peerId: id,
      })
    })

    socket.on('watcher', (id) => {
      watcher = id
      if (detections()) {
        socket.emit('detections', detections())
      }
      console.log('received watcher', id)
      peerConnection = new RTCPeerConnection(config)
      peerConnection.onicecandidate = (event): void => {
        if (event.candidate) {
          socket.emit('candidate', id, event.candidate)
        }
      }
    })

    socket.on('answer', (_, description) => {
      peerConnection.setRemoteDescription(description)
    })

    socket.on('candidate', (_, candidate) => {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
    })
  })

  createEffect(() => {
    const d = detections()
    if (d?.length && socket.connected) {
      console.log('emitting detections', d)
      socket.emit('detections', d)
    }
  })

  createEffect(() => {
    const w = watching()

    console.log(w)
  })

  // This function is called whenever the first frame of a new video feed is loaded,
  // so whenever we switch to a new detection
  const onDataLoad = (event: Event): void => {
    const video = event.target as HTMLVideoElement
    // @ts-ignore captureStream exists on the DOM but not in the typescript definitions
    const stream = video.captureStream()
    if (peerConnection) {
      const tracks = stream.getTracks()
      const track = tracks[0]
      const senders = peerConnection.getSenders()
      const sender = senders.find((s: RTCRtpSender) => s.track && s.track.kind === track.kind)

      if (sender) {
        console.log('replacing track', sender, track)
        sender.replaceTrack(track)
      } else {
        console.log('adding track', track)
        peerConnection.addTrack(track)
        // First offer must be created after adding tracks to peerConnection
        peerConnection
          .createOffer()
          .then((sdp) => peerConnection.setLocalDescription(sdp))
          .then(() => {
            socket.emit('offer', watcher, peerConnection.localDescription)
          })
      }
    }
  }

  return (
    <div class="container">
      <Header />

      <Show when={watching().detection && watching().peerId}>
        <video
          id="detection-viewer"
          crossOrigin="anonymous"
          src={
            watching().detection.startsWith('camera')
              ? `http://localhost:3001/stream/0`
              : `cmapp://${watching().detection}`
          }
          onLoadedData={onDataLoad}
          autoplay
          loop
        />
      </Show>
    </div>
  )
}
