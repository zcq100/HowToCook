import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wxss': 'text/css', '.wxml': 'text/plain', '.json': 'application/json' }
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost')
  const relative = url.pathname === '/' ? 'preview/index.html' : url.pathname.slice(1)
  const file = path.resolve(root, relative)
  if (!file.startsWith(root + path.sep) || !/^(preview|dist)\//.test(relative)) { response.writeHead(403).end(); return }
  fs.readFile(file, (error, body) => {
    if (error) { response.writeHead(404).end('Not found'); return }
    response.writeHead(200, { 'Content-Type': `${types[path.extname(file)] || 'text/plain'}; charset=utf-8`, 'Cache-Control': 'no-store' })
    response.end(body)
  })
})
server.listen(8766, '127.0.0.1', () => console.log('Mini program browser preview: http://127.0.0.1:8766'))
