import { Component, createEffect, createResource } from 'solid-js'

import { Header } from '@renderer/components/Header'
import { Api } from 'src/types'
import { AlertsTable } from '@renderer/components/AlertsTable'

export const Alerts: Component = () => {
  const [alerts] = createResource(async () => {
    return (window.api as Api).getAlerts()
  })

  createEffect(() => {
    console.log(alerts())
  })
  return (
    <>
      <Header />

      <AlertsTable alerts={alerts() || []} />
    </>
  )
}
