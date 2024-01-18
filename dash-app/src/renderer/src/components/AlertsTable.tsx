import { convertUnixTimestampToDateTime } from '@renderer/util/timestamp-to-datetime'
import { Component, For } from 'solid-js'
import { Alert } from 'src/database/models/Alert'

export interface Props {
  alerts: Alert[]
}
export const AlertsTable: Component<Props> = (props) => {
  return (
    <div class="p-8">
      <div class="bg-white p-4 rounded-md">
        <div class="flex justify-between mb-4">
          <div class="flex-1 pr-4">
            <div class="relative md:w-1/3">
              <input
                type="search"
                class="w-full bg-gray-200 text-sm text-black placeholder-gray-500 border border-gray-200 rounded-md py-2 pl-4 focus:bg-white focus:border-gray-300 focus:outline-none"
                placeholder="Search for items"
                autofocus
                autocomplete="off"
              />
            </div>
          </div>
        </div>
        <div class="overflow-x-auto relative shadow-md sm:rounded-lg">
          <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" class="py-3 px-6">
                  Alert number
                </th>
                <th scope="col" class="py-3 px-6">
                  Objects detected
                </th>
                <th scope="col" class="py-3 px-6">
                  Detection time
                </th>
                <th scope="col" class="py-3 px-6">
                  Detection feed
                </th>
                <th scope="col" class="py-3 px-6" />
                <th scope="col" class="py-3 px-6" />
              </tr>
            </thead>
            <tbody>
              <For each={props.alerts}>
                {(alert) => (
                  <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                    <td class="py-4 px-6">{alert.id}</td>
                    <td class="py-4 px-6">{alert.detection_objects}</td>
                    <td class="py-4 px-6">
                      {convertUnixTimestampToDateTime(alert.detection_time)}
                    </td>
                    <td class="py-4 px-6">{alert.detection_feed}</td>
                    <td class="py-4 px-6 text-right">
                      <a
                        href="#"
                        class="font-medium text-blue-600 dark:text-blue-500 hover:underline"
                      >
                        Play
                      </a>
                    </td>
                    <td class="py-4 px-6 text-right">
                      <a
                        href="#"
                        class="font-medium text-red-600 dark:text-red-500 hover:underline"
                      >
                        Delete
                      </a>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
