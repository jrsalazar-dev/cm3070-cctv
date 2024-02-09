import { type Component, For } from 'solid-js'
import { Switch } from '@kobalte/core'

import { Modal } from '@cm-apps/shared'
import { LiveFeed } from 'src/database/models/LiveFeed'

export interface Props {
  liveFeeds: LiveFeed[]
  isSettingsModalOpen: boolean
  setIsSettingsModalOpen: (value: boolean) => void
  onSetLiveFeedAlert: (id: number, enable: boolean) => void
}
export const SettingsModal: Component<Props> = (props) => {
  return (
    <Modal
      isOpen={props.isSettingsModalOpen}
      onClose={() => props.setIsSettingsModalOpen(false)}
      contentClass="rounded w-full max-w-2xl"
    >
      <div class="p-12 rounded-md bg-gray-800 flex flex-col justify-between align-middle text-gray-200">
        <h1 class="text-left text-2xl mb-7">Settings</h1>
        {
          // <h2 class="text-left text-xl mb-5">Live feeds</h2>
        }

        <For each={props.liveFeeds}>
          {(liveFeed) => (
            <div class="flex-col">
              <h3 class="mb-2">{liveFeed.name}</h3>
              <div class="flex-row justify-between align-middle cursor-pointer">
                <Switch.Root
                  onClick={() => props.onSetLiveFeedAlert(liveFeed.id, !liveFeed.is_detecting)}
                  class="switch w-full"
                  checked={liveFeed.is_detecting}
                  onChange={(checked: boolean) => props.onSetLiveFeedAlert(liveFeed.id, checked)}
                >
                  <div class="flex-col">
                    <Switch.Label class="switch__label text-lg">Email alerts</Switch.Label>
                    <Switch.Description class="text-gray-300 text-sm">
                      Send a notification by email when intruder is detected
                    </Switch.Description>
                  </div>
                  <Switch.Input class="switch__input" />
                  <Switch.Control class="switch__control bg-gray-600 data-[checked]:bg-blue-500">
                    <Switch.Thumb class="switch__thumb bg-white" />
                  </Switch.Control>
                </Switch.Root>
              </div>
            </div>
          )}
        </For>
      </div>
    </Modal>
  )
}
