import { Component, For, createSignal } from 'solid-js'
import { Pagination } from '@kobalte/core'

import { formatTime } from '../utils/format-time'
import { formatDate } from '../utils/format-date'
import { Alert } from '../types'

const PAGE_SIZE = 10

export interface Props {
  alerts: Alert[]
  onPlay: (alert: Alert) => void
  onDelete: (id: number) => void
}
export const AlertsTable: Component<Props> = (props) => {
  const [currentPage, setCurrentPage] = createSignal<number>(1)
  const totalPages = Math.ceil(props.alerts.length / PAGE_SIZE)

  return (
    <div class="p-8 bg-gray-800">
      <div class="p-4 rounded-md">
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
          <table class="w-full text-sm text-left text-gray-400">
            <thead class="text-xs uppercase bg-gray-700 text-gray-400">
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
                  Detection date
                </th>
                <th scope="col" class="py-3 px-6">
                  Detection feed
                </th>
                <th scope="col" class="py-3 px-6" />
                <th scope="col" class="py-3 px-6" />
              </tr>
            </thead>
            <tbody>
              <For
                each={props.alerts.slice(
                  currentPage() * PAGE_SIZE - PAGE_SIZE,
                  currentPage() * PAGE_SIZE > props.alerts.length
                    ? props.alerts.length
                    : currentPage() * PAGE_SIZE,
                )}
              >
                {(alert) => (
                  <tr class="border-b bg-gray-600 border-gray-700">
                    <td class="py-4 px-6">{alert.id}</td>
                    <td class="py-4 px-6 max-w-lg">{alert.detection_objects}</td>
                    <td class="py-4 px-6">{formatTime(alert.detection_time)}</td>
                    <td class="py-4 px-6">{formatDate(alert.detection_time)}</td>
                    <td class="py-4 px-6">{alert.detection_feed?.name}</td>
                    <td class="py-4 px-6 text-right">
                      <a
                        href="#"
                        onClick={() => props.onPlay(alert)}
                        class="font-medium text-blue-500 hover:underline"
                      >
                        Play
                      </a>
                    </td>
                    <td class="py-4 px-6 text-right">
                      <a
                        href="#"
                        onClick={() => props.onDelete(+alert.id)}
                        class="font-medium text-red-500 hover:underline"
                      >
                        Delete
                      </a>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>

          <Pagination.Root
            class="pagination__root mx-auto my-6"
            count={totalPages}
            // page={currentPage()}
            onPageChange={(page) => {
              console.log('changing page to ', page)
              setCurrentPage(page)
            }}
            defaultPage={1}
            siblingCount={0}
            itemComponent={(props) => (
              <Pagination.Item class="pagination__item bg-gray-300" page={props.page}>
                {props.page}
              </Pagination.Item>
            )}
            ellipsisComponent={() => (
              <Pagination.Ellipsis class="pagination__ellipsis bg-gray-300">
                ...
              </Pagination.Ellipsis>
            )}
          >
            <Pagination.Previous class="pagination__item bg-gray-300">Previous</Pagination.Previous>
            <Pagination.Items />
            <Pagination.Next class="pagination__item bg-gray-300">Next</Pagination.Next>
          </Pagination.Root>
        </div>
      </div>
    </div>
  )
}
