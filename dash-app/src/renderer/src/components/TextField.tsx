import { TextField as KTextField } from '@kobalte/core'
import { Component } from 'solid-js'

export interface Props {
  value: string
  onChange: (value: string) => void
  label: string
}
export const TextField: Component<Props> = (props) => {
  return (
    <KTextField.Root
      class="flex flex-col gap-2 w-full"
      value={props.value}
      onChange={props.onChange}
    >
      <KTextField.Label class="text-slate-200 text-lg">{props.label}</KTextField.Label>
      <KTextField.Input class="bg-gray-600 border-gray-50 border-solid border active:outline-zinc-700 focus-visible:outline-zinc-700 p-1" />
      <KTextField.Description />
      <KTextField.ErrorMessage />
    </KTextField.Root>
  )
}
