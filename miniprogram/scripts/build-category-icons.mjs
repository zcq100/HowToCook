import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// Reuse the H5 artwork without introducing React into the mini program.
const source = fs.readFileSync(new URL('../../web/src/categoryIcons.tsx', import.meta.url), 'utf8')
const icons = {}
// Mini program filters sit on the paper page, so use the H5 paper content palette.
const palette = { normal: '#76644f', selected: '#fbf3e2' }
for (const match of source.matchAll(/  (?:(\w+)|'([^']+)'): \(\s*<>\s*([\s\S]*?)\s*<\/>\s*\),/g)) {
  const id = match[1] || match[2]
  const body = match[3].replace(/\s+/g, ' ').trim()
  icons[id] = Object.fromEntries(Object.entries(palette).map(([state, color]) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="${state === 'normal' ? .8 : 1}">${body.replaceAll('currentColor', color)}</svg>`
    return [state, 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')]
  }))
}
const manifest = JSON.parse(fs.readFileSync(new URL('../src/data/manifest.json', import.meta.url), 'utf8'))
for (const id of ['all', ...manifest.categories]) if (!icons[id]) throw new Error(`Missing H5 category icon: ${id}`)
fs.writeFileSync(fileURLToPath(new URL('../src/data/category-icons.ts', import.meta.url)), `// Generated from web/src/categoryIcons.tsx by scripts/build-category-icons.mjs.\nexport const categoryIcons: Record<string, { normal: string; selected: string }> = ${JSON.stringify(icons, null, 2)}\n`)
console.log(`Generated ${Object.keys(icons).length} category icons from H5.`)
