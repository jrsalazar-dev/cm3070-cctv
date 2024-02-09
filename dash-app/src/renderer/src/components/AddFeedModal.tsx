import { createSignal, type Component } from 'solid-js'

import { Modal } from '@cm-apps/shared'
import { TextField } from './TextField'
import { Button } from '@kobalte/core'

export interface PartialLiveFeed {
  name: string
  cameraIndex?: number
  url?: string
}
export interface Props {
  isOpen: boolean
  setIsOpen: (value: boolean) => void
  onSaveLiveFeed: (liveFeed: PartialLiveFeed) => void
}
export const AddFeedModal: Component<Props> = (props) => {
  const [liveFeedName, setLiveFeedName] = createSignal('')
  const [liveFeedUrl, setLiveFeedUrl] = createSignal('')
  const [liveFeedIndex, setLiveFeedIndex] = createSignal('')

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={() => props.setIsOpen(false)}
      contentClass="rounded w-full max-w-lg"
    >
      <div class="p-12 rounded-md bg-gray-800 flex flex-col justify-between align-middle text-gray-200">
        <h1 class="text-left text-2xl mb-7">Add Live Feed</h1>

        <TextField label="Name" value={liveFeedName()} onChange={setLiveFeedName} />

        <TextField label="Network URL" value={liveFeedUrl()} onChange={setLiveFeedUrl} />

        <TextField label="Camera index" value={liveFeedIndex()} onChange={setLiveFeedIndex} />

        <Button.Root
          class="bg-zinc-300 text-slate-800 p-2 rounded-s mt-7"
          onClick={() => {
            if (liveFeedUrl()) {
              props.onSaveLiveFeed({
                name: liveFeedName(),
                cameraIndex: undefined,
                url: liveFeedUrl(),
              })
              props.setIsOpen(false)
            } else if (liveFeedIndex() && !isNaN(parseInt(liveFeedIndex()))) {
              props.onSaveLiveFeed({
                name: liveFeedName(),
                cameraIndex: +liveFeedIndex(),
                url: undefined,
              })
              props.setIsOpen(false)
            }
          }}
        >
          Save live feed
        </Button.Root>
      </div>
    </Modal>
  )
}
