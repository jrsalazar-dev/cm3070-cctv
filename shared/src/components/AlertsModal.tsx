import { type Component } from 'solid-js'

import { Modal } from './Modal'
import { AlertsTable } from './AlertsTable'
import { Alert } from '../types'

export interface AlertsModalProps {
  alerts: Alert[]
  onPlay: (alert: Alert) => void
  isOpen: boolean
  onClose: () => void
  onDelete: (id: number) => void
}
export const AlertsModal: Component<AlertsModalProps> = (props) => {
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose}>
      <AlertsTable
        alerts={props.alerts}
        onPlay={(alert: Alert) => {
          props.onPlay(alert)
          props.onClose()
        }}
        onDelete={props.onDelete}
      />
    </Modal>
  )
}
