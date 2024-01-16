import { For, createEffect, createSignal, onMount } from 'solid-js'
import { io } from 'socket.io-client'

let peerConnection: RTCPeerConnection
const config = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302'],
    },
  ],
}

export default function Home() {
  const [detections, setDetections] = createSignal([])
  const [watching, setWatching] = createSignal('')

  const socket = io()

  socket.on('connect', () => {
    console.log('connected watcher with id', socket.id)

    socket.emit('watcher', socket.id)

    socket.on('offer', (id, description) => {
      console.log('on offer')
      peerConnection = new RTCPeerConnection(config)
      peerConnection
        .setRemoteDescription(description)
        .then(() => peerConnection.createAnswer())
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => {
          socket.emit('answer', id, peerConnection.localDescription)
        })
      peerConnection.ontrack = (event) => {
        const video = document.getElementById('video-stream') as HTMLVideoElement
        console.log('ontrack', video, event)
        const track = event.track
        const stream = new MediaStream()
        stream.addTrack(track)
        video.srcObject = stream
        video.play()
      }
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('candidate', id, event.candidate)
        }
      }
    })
    socket.on('candidate', (id, candidate) => {
      console.log('on candidate')
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) => console.error(e))
    })

    socket.on('broadcaster', () => {
      console.log('emitting watcher')
      socket.emit('watcher', socket.id)
    })

    socket.on('detections', (detections) => {
      console.log('detections', detections)
      setDetections(detections)
    })
  })
  socket.on('disconnect', () => {
    console.log('disconnected')
  })

  createEffect(() => {
    if (watching()) {
      console.log('watching', watching())
      socket.emit('watch', socket.id, watching())
    }
  })

  return (
    <section class="bg-gray-100 text-gray-700 p-8">
      <h1 class="text-2xl font-bold">Remote viewing</h1>
      <p class="mt-4">Here you can watch your home camera streams</p>

      <div>
        <button onClick={() => setWatching('camera0')}>Camera 0</button>
      </div>
      <For each={detections()}>
        {(detection) => (
          <div>
            <button onClick={() => setWatching(detection)}>{detection}</button>
          </div>
        )}
      </For>

      <video id="video-stream" style={{ width: '100%', 'max-width': '840px' }} loop autoplay />
    </section>
  )
}
