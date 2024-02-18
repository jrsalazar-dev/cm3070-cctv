import type { Component } from 'solid-js'

export const GhostButton: Component<{ onClick: () => void; class?: string; children: any }> = (
  props,
) => {
  return (
    <a
      href="#"
      onClick={props.onClick}
      class={`inline-block py-2 px-4 text-lg rounded-3xl border border-solid border-active ${props.class}`}
    >
      {props.children}
    </a>
  )
}
