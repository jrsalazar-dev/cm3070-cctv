import { For, Show, createEffect, createSignal } from 'solid-js'
import { io } from 'socket.io-client'
import { AlertsModal, Header, formatDate, formatTime } from '@cm-apps/shared'
import { Alert } from '../types'
import { useSearchParams } from '@solidjs/router'

let peerConnection: RTCPeerConnection
const config = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302'],
    },
  ],
}

interface Watching {
  liveFeed?: number
  alert?: string
}
export default function Home() {
  const [paramsProxy, setParams] = useSearchParams()
  const params = { ...paramsProxy }

  const [isModalOpen, setIsModalOpen] = createSignal(false)
  const [alerts, setAlerts] = createSignal([])
  const [liveFeeds, setLiveFeeds] = createSignal([])
  const [watching, setWatching] = createSignal<Watching>({
    alert: undefined,
  })

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
    socket.on('candidate', (_, candidate) => {
      console.log('on candidate')
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) => console.error(e))
    })

    socket.on('broadcaster', () => {
      console.log('emitting watcher')
      socket.emit('watcher', socket.id)
    })

    socket.on('alerts', (alerts) => {
      console.log('alerts', alerts)
      setAlerts(alerts)
      if (params.alertId) {
        console.log('setting watching', params.alertId)
        setWatching({ alert: params.alertId })
      }
    })

    socket.on('liveFeeds', (liveFeeds) => {
      console.log('liveFeeds', liveFeeds)
      setLiveFeeds(liveFeeds)
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

  const formatAlertName = (alertId: string, alerts: Alert[]) => {
    const alert = alerts.find((a) => a.id === alertId)
    if (!alert) return ''
    return `${formatTime(alert.detection_time)} ${formatDate(alert.detection_time)} Feed: ${alert
      .detection_feed?.name}`
  }

  return (
    <div class="container mx-auto">
      <Header openAlertsModal={() => setIsModalOpen(true)} />
      <section class="bg-gray-800 text-gray-300 p-8">
        <Show when={watching().alert || watching().liveFeed}>
          <div class="relative w-full h-full">
            <h1 class="text-2xl text-slate-200 dark:bg-black dark:bg-opacity-70 p-3 font-light mx-auto absolute top-0 left-0">
              {watching().alert
                ? formatAlertName(watching().alert, alerts())
                : liveFeeds().find((f) => f.id === watching().liveFeed)?.name}
            </h1>
            <video class="mx-auto w-full" id="video-stream" crossOrigin="anonymous" autoplay loop />
          </div>
        </Show>

        <div class="pagination__root mt-5">
          <ul>
            <For each={liveFeeds()}>
              {(feed) => (
                <button
                  class="pagination__item bg-gray-300"
                  onClick={() =>
                    setWatching({
                      liveFeed: feed.id,
                      alert: undefined,
                    })
                  }
                >
                  {feed.name}
                </button>
              )}
            </For>
          </ul>
        </div>

        <AlertsModal
          onDelete={() => {}}
          onClose={() => setIsModalOpen(false)}
          isOpen={isModalOpen()}
          alerts={alerts()}
          onPlay={(alert) => setWatching({ alert: alert.id, liveFeed: undefined })}
        />
      </section>
    </div>
  )
}
