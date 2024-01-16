const http = require('http')
const httpProxy = require('http-proxy')

// Create a proxy server
const proxy = httpProxy.createProxyServer({})

// Create an HTTP server that listens on port 3001 and forwards requests to port 5000
const server = http.createServer(function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  proxy.web(req, res, { target: 'http://localhost:5000' })
})

server.listen(3001, () => {
  console.log('Proxy server running on http://localhost:3001')
})
