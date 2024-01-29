const express = require('express')

const net = require('net')

const app = express()

console.log('loading tcp stream server')

app.get('/stream/:stream', function (req, res) {
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
    console.log('TCP Client end')
    res.end()
  })

  tcpClient.on('error', (error) => {
    console.error('TCP Client Error:', error)
    res.end()
  })

  // Set a timeout for inactivity
  tcpClient.setTimeout(60_000) // 5 minutes, for example

  tcpClient.on('timeout', () => {
    console.log('Socket timed out due to inactivity')
    tcpClient.end()
    res.end()
  })
})

app.listen(3001)
