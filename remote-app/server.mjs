import express from 'express'
import ViteExpress from 'vite-express'
import http from 'http'
import { Server } from 'socket.io'

const port = 3000
const app = express()

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
  },
})

app.use(express.static(import.meta.dir + '/public'))

io.sockets.on('error', (e) => console.error(e))
server.listen(port, () => console.log(`Server is running on port ${port}`))

let broadcaster
let watcher

io.on('connection', (socket) => {
  console.log('user connected', socket.id)

  socket.on('broadcaster', (id) => {
    broadcaster = id
    console.log(`found broadcaster ${broadcaster} in ${socket.id}`)
  })
  socket.on('watcher', (id) => {
    console.log('emitting watcher with id:', id)
    watcher = id
    socket.to(broadcaster).emit('watcher', id)
  })
  socket.on('disconnect', () => {
    socket.to(broadcaster).emit('disconnectPeer', socket.id)
  })
  socket.on('offer', (id, message) => {
    socket.to(id).emit('offer', socket.id, message)
  })
  socket.on('detections', (detections) => {
    console.log('server detections', detections)
    socket.to(watcher).emit('detections', detections)
  })
  socket.on('watch', (id, detection) => {
    console.log('server set watch')
    socket.to(broadcaster).emit('watch', id, detection)
  })
  socket.on('answer', (id, message) => {
    socket.to(id).emit('answer', socket.id, message)
  })
  socket.on('candidate', (id, message) => {
    socket.to(id).emit('candidate', socket.id, message)
  })
})

ViteExpress.bind(app, server)
