import 'reflect-metadata'

import { render } from 'solid-js/web'
import { Route, Router } from '@solidjs/router'

import './assets/index.css'

import { Live } from './screens/Live'
import { Alerts } from './screens/Alerts'
import { Settings } from './screens/Settings'

render(
  () => (
    <Router>
      <Route path="/" component={Live} />
      <Route path="/alerts" component={Alerts} />
      <Route path="/settings" component={Settings} />
    </Router>
  ),
  document.getElementById('root') as HTMLElement,
)
