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
    <div class="p-8 bg-default">
      <div class="p-4 rounded-md">
        <div class="flex justify-between mb-4">
          <div class="flex-1 pr-4">
            <div class="relative md:w-1/3">
              <h3 class="text-white">
                Here you can view the recent alerts generated by the movement detection system.
              </h3>
            </div>
          </div>
        </div>
        <div class="overflow-x-auto relative shadow-md sm:rounded-lg">
          <table class="w-full text-sm text-left text-gray-400">
            <thead class="text-xs uppercase text-gray-400">
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
                  <tr class="border-b border-gray-700">
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
            class="pagination__root flex flex-row justify-center mx-auto my-6 text-active"
            count={totalPages}
            // page={currentPage()}
            onPageChange={(page) => {
              console.log('changing page to ', page)
              setCurrentPage(page)
            }}
            defaultPage={1}
            siblingCount={0}
            itemComponent={(props) => (
              <Pagination.Item
                class={`inline-block py-2 px-4 text-lg cursor-pointer ${
                  props.page === currentPage() ? 'underline underline-offset-4' : ''
                }`}
                page={props.page}
              >
                {props.page}
              </Pagination.Item>
            )}
            ellipsisComponent={() => (
              <Pagination.Ellipsis class="bg-default text-active">...</Pagination.Ellipsis>
            )}
          >
            <Pagination.Previous class="inline-block py-2 px-4 text-lg rounded-3xl border border-solid border-active cursor-pointer">
              Previous
            </Pagination.Previous>
            <Pagination.Items />
            <Pagination.Next class="inline-block py-2 px-4 text-lg rounded-3xl border border-solid border-active cursor-pointer">
              Next
            </Pagination.Next>
          </Pagination.Root>
        </div>
      </div>
    </div>
  )
}
