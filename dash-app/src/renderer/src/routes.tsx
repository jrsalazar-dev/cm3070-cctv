import { Route, Router } from '@solidjs/router'
import { type JSX } from 'solid-js'

import { Home } from './screens/Home'

export const router = (): JSX.Element => {
  return (
    <Router>
      <Route path="/" component={Home} />
    </Router>
  )
}
