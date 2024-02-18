import type { Component } from 'solid-js'
import { GhostButton } from './GhostButton'

export interface HeaderProps {
  openAlertsModal: () => void
  openSettingsModal?: () => void
}
export const Header: Component<HeaderProps> = (props) => {
  return (
    <header class="bg-default text-active text-center p-4">
      <nav>
        <ul class="flex flex-row justify-end space-x-4">
          <li>
            <GhostButton onClick={props.openAlertsModal}>Alerts</GhostButton>
          </li>
          {props.openSettingsModal ? (
            <li>
              <GhostButton onClick={props.openSettingsModal}>Settings</GhostButton>
            </li>
          ) : null}
        </ul>
      </nav>
    </header>
  )
}
