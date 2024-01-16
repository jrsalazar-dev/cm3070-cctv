const express = require('express')

const net = require('net')

const app = express()

console.log('loading tcp stream server')

app.get('/stream/:stream', function (req, res) {
  const date = new Date()
  const streamNumber = req.params.stream

  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    // Connection: 'close',
    // 'Cache-Control': 'private',
    'Content-Type': 'video/webm',
  })

  const tcpClient = net.createConnection(
    {
      host: 'localhost',
      port: 5000 + Number(streamNumber),
    },
    () => {
      console.log('created tcp server')
    },
  )

  tcpClient.on('data', (data) => {
    res.write(data)
  })

  tcpClient.on('end', () => {
    console.error('TCP Client end')
    res.end()
  })

  tcpClient.on('error', (error) => {
    console.error('TCP Client Error:', error)
    res.end()
  })
})

app.listen(3001)
