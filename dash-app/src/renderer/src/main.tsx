import 'reflect-metadata'

import { render } from 'solid-js/web'

import './assets/index.css'
import { router } from './routes'

render(router, document.getElementById('root') as HTMLElement)
