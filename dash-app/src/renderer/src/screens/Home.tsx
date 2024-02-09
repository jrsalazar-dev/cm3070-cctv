import { type Component, createResource, createSignal, Show, createEffect, For } from 'solid-js'
import { TbLoader } from 'solid-icons/tb'
import { io } from 'socket.io-client'
import { AlertsModal, Header, formatTime, formatDate } from '@cm-apps/shared'
import { LiveFeed } from 'src/database/models/LiveFeed'
import { Alert } from 'src/database/models/Alert'
import { Button } from '@kobalte/core'
import { SettingsModal } from '@renderer/components/SettingsModal'
import { AddFeedModal } from '@renderer/components/AddFeedModal'

let peerConnection: RTCPeerConnection | undefined
const config = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302'],
    },
  ],
}

let watcher: string | undefined
export const Home: Component = () => {
  const socket = io('http://localhost:3000')
  const [alerts, { refetch: refetchAlerts }] = createResource(async () => {
    return window.api.getAlerts()
  })
  const [liveFeeds, { refetch: refetchLiveFeeds }] = createResource<LiveFeed[]>(async () => {
    return window.api.getLiveFeeds()
  })
  // const [currentFeed, setCurrentFeed] = createSignal<number>(0)

  const [watching, setWatching] = createSignal({
    name: 'Main Webcam',
    video: 'camera0',
  })

  // createEffect(() => {
  //   console.log('currentFeed', currentFeed())
  // })

  // createEffect(() => {
  //   const l = liveFeeds()?.[0]
  //
  //   if (l?.cameraIndex) {
  //     setWatching({
  //       name: l.name,
  //       video: `camera${l.cameraIndex}`,
  //     })
  //   }
  // })

  socket.on('connect', () => {
    socket.emit('broadcaster', socket.id)
    console.log('connected with id', socket.id)

    if (alerts()) {
      console.log('emitting alerts', alerts())
      socket.emit('alerts', alerts())
    }

    if (liveFeeds()) {
      console.log('emitting liveFeeds', liveFeeds())
      socket.emit('liveFeeds', liveFeeds())
    }

    socket.on('watch', (_, { alert: alertId, liveFeed }) => {
      if (liveFeed) {
        const foundFeed = liveFeeds()?.findIndex((l) => l.id === liveFeed)
        if (typeof foundFeed !== 'number') {
          console.log('feed not found', liveFeed)
          return
        }
        setWatching({
          video: `camera${foundFeed}`,
          name: liveFeeds()?.[foundFeed].name || '',
        })
      } else if (alertId) {
        const alert = alerts()?.find((a: Alert) => a.id === +alertId)
        if (alert) {
          setWatching({
            video: alert.filepath,
            name: `${formatTime(alert.detection_time)} ${formatDate(alert.detection_time)}`,
          })
        }
      }
    })

    socket.on('watcher', (id) => {
      watcher = id
      if (alerts()) {
        socket.emit('alerts', alerts())
      }
      if (liveFeeds()) {
        socket.emit('liveFeeds', liveFeeds())
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
      peerConnection?.setRemoteDescription(description)
    })

    socket.on('candidate', (_, candidate) => {
      peerConnection?.addIceCandidate(new RTCIceCandidate(candidate))
    })

    socket.on('disconnect', () => {
      console.log(`disconnecting from watcher ${watcher}`)
      watcher = undefined
      peerConnection = undefined
    })
  })

  createEffect(() => {
    const d = alerts()
    if (d?.length && socket.connected) {
      console.log('emitting alerts', d)
      socket.emit('alerts', d)
    }
  })

  createEffect(() => {
    const d = liveFeeds()
    if (d?.length && socket.connected) {
      console.log('emitting liveFeeds', d)
      socket.emit('liveFeeds', d)
    }
  })

  createEffect(() => {
    const w = watching()

    console.log('watching', w)
  })

  // This function is called whenever the first frame of a new video feed is loaded,
  // so whenever we switch to a new video
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
          .then((sdp) => peerConnection?.setLocalDescription(sdp))
          .then(() => {
            socket.emit('offer', watcher, peerConnection?.localDescription)
          })
      }
    }
  }

  const [isAlertsModalOpen, setIsAlertsModalOpen] = createSignal<boolean>(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = createSignal<boolean>(false)
  const [isAddLiveFeedModalOpen, setIsAddLiveFeedModalOpen] = createSignal<boolean>(false)
  const [surveillanceIsLoaded, setSurveillanceIsLoaded] = createSignal<boolean>(false)

  window.api.start().then((msg) => {
    console.log('started probably message:', msg)
    setSurveillanceIsLoaded(msg)
  })

  const onDeleteAlert = (id: number): void => {
    window.api.deleteAlert(id)
    refetchAlerts()
  }
  const onSetLiveFeedAlerting = (id: number, enabled: boolean): void => {
    window.api.setLiveFeedAlerting(id, enabled)
    refetchLiveFeeds()
  }

  return (
    <Show
      when={surveillanceIsLoaded()}
      fallback={
        <div class="container w-full h-lvh flex flex-col items-center justify-center text-white">
          <TbLoader class="animate-spin text-6xl" />
          <h1 class="mt-3">Starting cameras</h1>
        </div>
      }
    >
      <div class="container mx-auto">
        <Header
          openSettingsModal={() => setIsSettingsModalOpen(true)}
          openAlertsModal={() => setIsAlertsModalOpen(true)}
        />

        <Show when={watching().video}>
          <div class="relative w-full h-full">
            <video
              class="mx-auto w-full"
              id="video-viewer"
              crossOrigin="anonymous"
              src={
                watching().video.startsWith('camera')
                  ? `http://localhost:3001/stream/${watching().video.replace('camera', '')}`
                  : `cmapp://${watching().video}`
              }
              onLoadedData={onDataLoad}
              autoplay
              loop
            />
            <h1 class="text-2xl text-slate-200 dark:bg-black dark:bg-opacity-70 p-3 font-light mx-auto absolute top-0 left-0">
              {watching().name}
            </h1>
            <Show when={watching().video.startsWith('camera')}>
              <Show
                when={liveFeeds()?.[watching().video.replace('camera', '')]?.is_detecting}
                fallback={
                  <Button.Root class="absolute top-0 right-0 bg-red-700 text-slate-200 p-2 rounded-s">
                    Detections off
                  </Button.Root>
                }
              >
                <Button.Root class="absolute top-0 right-0 bg-emerald-700 text-slate-200 p-2 rounded-s">
                  Detections on
                </Button.Root>
              </Show>
            </Show>
          </div>
        </Show>

        <div class="pagination__root mt-5">
          <ul>
            <For each={liveFeeds()}>
              {(feed, index) => (
                <li>
                  <button
                    class="pagination__item bg-gray-300"
                    onClick={() =>
                      setWatching({
                        video: `camera${index()}`,
                        name: feed.name,
                      })
                    }
                  >
                    {feed.name}
                  </button>
                </li>
              )}
            </For>
            <li>
              <button
                class="pagination__item bg-gray-300"
                onClick={() => setIsAddLiveFeedModalOpen(true)}
              >
                Add live feed
              </button>
            </li>
          </ul>
        </div>

        <AddFeedModal
          isOpen={isAddLiveFeedModalOpen()}
          setIsOpen={setIsAddLiveFeedModalOpen}
          onSaveLiveFeed={(liveFeed) => {
            const f = async (): Promise<void> => {
              const res = await window.api.addLiveFeed(liveFeed)
              console.log(res)
              setIsAddLiveFeedModalOpen(false)
              refetchLiveFeeds()
            }
            f()
          }}
        />

        <SettingsModal
          liveFeeds={liveFeeds() || []}
          isSettingsModalOpen={isSettingsModalOpen()}
          setIsSettingsModalOpen={setIsSettingsModalOpen}
          onSetLiveFeedAlert={(id, enable) => onSetLiveFeedAlerting(id, enable)}
        />

        <AlertsModal
          alerts={alerts()}
          isOpen={isAlertsModalOpen()}
          onClose={() => setIsAlertsModalOpen(false)}
          onDelete={onDeleteAlert}
          onPlay={(alert) => {
            setWatching({
              video: alert.filepath,
              name: `${formatTime(alert.detection_time)} ${formatDate(
                alert.detection_time,
              )} Feed: ${alert.detection_feed?.name}`,
            })
            setIsAlertsModalOpen(false)
          }}
        />
      </div>
    </Show>
  )
}
