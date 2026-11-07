import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = path.join(root, 'dist')
// Only our own generated directory is replaced. Never copy Web output or dishes.
fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(dist, { recursive: true })
fs.cpSync(path.join(root, 'build/miniprogram/src'), dist, { recursive: true })
function copyAssets(dir, target) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const source = path.join(dir, entry.name)
    const destination = path.join(target, entry.name)
    if (entry.isDirectory()) { fs.mkdirSync(destination, { recursive: true }); copyAssets(source, destination) }
    else if (/\.(json|wxml|wxss)$/.test(entry.name)) fs.copyFileSync(source, destination)
  }
}
copyAssets(path.join(root, 'src'), dist)
console.log('Packaged native project: miniprogram/dist')
