import { Component, For, Show } from 'solid-js'
import { LiveFeed } from '../types'

interface Watching {
  video: number
  name: string
}
export interface LiveFeedTabProps {
  feed: LiveFeed
  watchingId: Watching['video']
  setWatching: (w: Watching) => void
  onDelete?: (id: number) => void
}
export const LiveFeedTab: Component<LiveFeedTabProps> = (props) => {
  return (
    <li
      class={`flex flex-row items-center justify-between p-3 rounded-t-lg ${
        props.feed.id === props.watchingId ? 'bg-active text-black' : 'bg-secondary text-active'
      }`}
    >
      <button
        class="w-full h-full inline-block"
        onClick={() =>
          props.setWatching({
            video: props.feed.id,
            name: props.feed.name,
          })
        }
      >
        {props.feed.name}
      </button>
      <Show when={props.onDelete}>
        <button class="ml-3" onClick={() => props.onDelete?.(props.feed.id)}>
          <svg
            width="12"
            height="13"
            viewBox="0 0 12 13"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 0.812046L11.688 0.5L6 6.18795L0.312046 0.5L0 0.812046L5.68795 6.5L0 12.188L0.312046 12.5L6 6.81205L11.688 12.5L12 12.188L6.31205 6.5L12 0.812046Z"
              fill={props.feed.id === props.watchingId ? 'black' : '#9696ca'}
            />
          </svg>
        </button>
      </Show>
    </li>
  )
}
