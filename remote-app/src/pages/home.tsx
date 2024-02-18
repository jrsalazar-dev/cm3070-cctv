import { For, Show, createEffect, createSignal } from 'solid-js'
import { useSearchParams } from '@solidjs/router'
import { TbLoader } from 'solid-icons/tb'
import { io } from 'socket.io-client'

import {
  AlertsModal,
  GhostButton,
  Header,
  LiveFeedTab,
  formatDate,
  formatTime,
} from '@cm-apps/shared'

import { Alert } from '../types'
import { Button } from '@kobalte/core'

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
  const [isLoaded, setIsLoaded] = createSignal(false)
  const [isConfirmed, setIsConfirmed] = createSignal(false)
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
        setParams({ alertId: undefined })
      }
    })

    socket.on('liveFeeds', (liveFeeds) => {
      console.log('liveFeeds', liveFeeds)
      setLiveFeeds(liveFeeds)
      console.log('setting is loaded')
      setIsLoaded(true)
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
      <section class="bg-default text-gray-300 p-8">
        <Show when={watching().alert || watching().liveFeed}>
          <div class="relative w-full h-full">
            <div class="pagination__root absolute top-0 -translate-y-10">
              <ul>
                <For each={liveFeeds()}>
                  {(feed) => (
                    <LiveFeedTab
                      feed={feed}
                      watchingId={watching().liveFeed}
                      setWatching={(w) =>
                        setWatching({
                          liveFeed: w.video,
                          alert: undefined,
                        })
                      }
                    />
                  )}
                </For>
              </ul>
            </div>

            <video
              class="mx-auto w-full z-50 translate-x-0"
              id="video-stream"
              crossOrigin="anonymous"
              autoplay
              loop
            />
          </div>
        </Show>

        <AlertsModal
          onDelete={() => {}}
          onClose={() => setIsModalOpen(false)}
          isOpen={isModalOpen()}
          alerts={alerts()}
          onPlay={(alert) => setWatching({ alert: alert.id, liveFeed: undefined })}
        />
      </section>

      <Show when={!isConfirmed()}>
        <Show
          when={isLoaded()}
          fallback={
            <div class="fixed top-0 container w-full h-lvh flex flex-col items-center justify-center text-white bg-default">
              <TbLoader class="animate-spin text-6xl" />
              <h1 class="mt-3">Connecting to home cameras</h1>
            </div>
          }
        >
          <div class="fixed top-0 container w-full h-lvh flex flex-col items-center justify-center text-white bg-default">
            <h1 class="mb-3">Finished connecting</h1>
            <GhostButton
              class="p-3 bg-gray-600 text-zinc-50"
              onClick={() => {
                setIsConfirmed(true)
                if (!watching().alert && !watching().liveFeed) {
                  setWatching({
                    liveFeed: liveFeeds()[0].id,
                  })
                }
                const video = document.getElementById('video-stream') as HTMLVideoElement
                video?.play()
              }}
            >
              Enter page
            </GhostButton>
          </div>
        </Show>
      </Show>
    </div>
  )
}
