import type { Component } from 'solid-js'

export interface HeaderProps {
  openAlertsModal: () => void
  openSettingsModal?: () => void
}
export const Header: Component<HeaderProps> = (props) => {
  return (
    <header class="bg-gray-800 text-white text-center p-4">
      <nav>
        <ul class="flex flex-row justify-center space-x-4">
          <li>
            <a href="#" onClick={props.openAlertsModal} class="hover:text-gray-300 text-lg">
              Alerts
            </a>
          </li>
          {props.openSettingsModal ? (
            <li>
              <a href="#" onClick={props.openSettingsModal} class="hover:text-gray-300 text-lg">
                Settings
              </a>
            </li>
          ) : null}
        </ul>
      </nav>
    </header>
  )
}
