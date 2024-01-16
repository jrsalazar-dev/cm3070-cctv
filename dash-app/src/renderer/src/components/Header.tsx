import type { Component } from 'solid-js'
import { A } from '@solidjs/router'

export const Header: Component = () => {
  return (
    <header class="bg-gray-800 text-white text-center p-4">
      <nav>
        <ul class="flex flex-row justify-center space-x-4">
          <li>
            <A href="/" class="hover:text-gray-300" activeClass="underline" end>
              Live
            </A>
          </li>
          <li>
            <A href="/alerts" class="hover:text-gray-300" activeClass="underline">
              Alerts
            </A>
          </li>
          <li>
            <A href="/settings" class="hover:text-gray-300" activeClass="underline">
              Settings
            </A>
          </li>
        </ul>
      </nav>
    </header>
  )
}
