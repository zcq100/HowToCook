import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// Clean only our compiler output, including modules removed from the source.
fs.rmSync(fileURLToPath(new URL('../build', import.meta.url)), { recursive: true, force: true })
