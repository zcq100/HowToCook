import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const { repository } = require(path.join(root, 'dist/services/repository.js'))
const { connectionsSvg, svgDataUrl } = require(path.join(root, 'dist/services/blueprint-connections.js'))
const { buildBlueprint, zoomAt, connectionPoints, constrainCamera } = require(path.join(root, 'dist/services/blueprint.js'))
const categories = await repository.listCategories()
assert.equal(categories.length, 10)
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/data/manifest.json'), 'utf8'))
const dishesRoot = path.resolve(root, '../dishes')
function sourceIds(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'template' ? [] : sourceIds(file)
    return entry.name.endsWith('.md') && entry.name !== 'index.md' ? [path.relative(dishesRoot, file).replace(/\\/g, '/').slice(0, -3)] : []
  })
}
const expectedIds = sourceIds(dishesRoot).sort()
assert.equal(manifest.count, expectedIds.length)
assert.deepEqual([...manifest.ids].sort(), expectedIds)
assert.equal(categories.reduce((n, c) => n + c.count, 0), manifest.count)
async function allRecipes(query = {}) {
  const items = []
  let cursor
  do {
    const result = await repository.listRecipes({ ...query, limit: 50, cursor })
    items.push(...result.items)
    cursor = result.nextCursor
  } while (cursor)
  return items
}
assert.deepEqual((await allRecipes()).map(item => item.id).sort(), expectedIds)
const first = await repository.listRecipes({ limit: 7 })
const second = await repository.listRecipes({ cursor: first.nextCursor, limit: 7 })
assert.equal(first.items.length, 7)
assert.equal(second.items.length, 7)
assert.equal(new Set([...first.items, ...second.items].map(r => r.id)).size, 14)
const query = await repository.listRecipes({ q: '  豆腐  ' })
assert.ok(query.items.length)
assert.ok((await repository.listRecipes({ category: 'soup' })).items.every(r => r.category === 'soup'))
assert.equal((await repository.listRecipes({ q: '不存在的菜谱xyz' })).items.length, 0)
await assert.rejects(repository.getRecipe('missing'))
await assert.rejects(repository.listRecipes({ cursor: '-1' }))
for (const category of categories) {
  for (const summary of await allRecipes({ category: category.id })) {
    const recipe = await repository.getRecipe(decodeURIComponent(encodeURIComponent(summary.id)))
    assert.ok(recipe.steps.length)
    assert.equal(recipe.images.length, 0)
    assert.equal(recipe.cover, null)
    assert.ok(!JSON.stringify(recipe).includes('!['), 'recipe must not contain Markdown images')
    const graph = buildBlueprint(recipe)
    const ids = new Set(graph.nodes.map(node => node.id))
    assert.equal(ids.size, graph.nodes.length, 'graph IDs must be unique')
    assert.equal(graph.edges.filter(edge => edge.kind === 'flow').length, recipe.steps.length + 1)
    for (const edge of graph.edges) {
      assert.ok(ids.has(edge.source) && ids.has(edge.target), 'every edge must have valid endpoints')
      if (edge.kind === 'ingredient') assert.ok(recipe.steps[edge.stepIndex].uses.includes(edge.source))
      const source = graph.nodes.find(node => node.id === edge.source)
      const target = graph.nodes.find(node => node.id === edge.target)
      const points = connectionPoints(edge, source, target)
      assert.ok(points.ty >= target.y && points.ty <= target.y + target.height, 'connection must terminate on its target node')
    }
    for (const step of recipe.steps) {
      const inputs = graph.edges.filter(edge => edge.target === step.id && edge.kind === 'ingredient')
      assert.equal(new Set(inputs.map(edge => edge.inputIndex)).size, inputs.length, 'each ingredient needs a distinct input port')
    }
    for (const node of graph.nodes) {
      assert.ok(node.x >= 0 && node.y >= 0 && node.x + node.width <= graph.width && node.y + node.height <= graph.height)
      for (const other of graph.nodes) {
        if (node === other) continue
        assert.ok(node.x + node.width <= other.x || other.x + other.width <= node.x || node.y + node.height <= other.y || other.y + other.height <= node.y, 'nodes must not overlap')
      }
    }
    const measured = buildBlueprint(recipe, Object.fromEntries(graph.nodes.map(node => [node.id, node.height * 2])))
    assert.ok(measured.height > graph.height, 'layout must respond to real node sizes')
  }
}
let bytes = 0
function inspect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) inspect(file)
    else { assert.match(entry.name, /\.(js|json|wxml|wxss)$/); bytes += fs.statSync(file).size }
  }
}
inspect(path.join(root, 'dist'))
assert.ok(bytes < 1.5 * 1024 * 1024, `Package exceeds internal budget: ${bytes}`)
const app = JSON.parse(fs.readFileSync(path.join(root, 'dist/app.json')))
for (const page of app.pages) for (const extension of ['js', 'wxml']) assert.ok(fs.existsSync(path.join(root, 'dist', `${page}.${extension}`)))
// Exercise the compiled page's share path, error state and display data.
let pageDefinition
globalThis.Page = definition => { pageDefinition = definition }
globalThis.wx = { setNavigationBarTitle() {} }
require(path.join(root, 'dist/pages/recipe/index.js'))
const page = { ...pageDefinition, data: { ...pageDefinition.data }, setData(patch) { Object.assign(this.data, patch) } }
page.recipeId = first.items[0].id
await page.loadRecipe()
assert.equal(page.data.recipe.id, first.items[0].id)
assert.equal(page.data.loading, false)
assert.equal(typeof page.data.recipe.ingredients[0].amountsText, 'string')
const share = page.onShareAppMessage()
assert.equal(decodeURIComponent(share.path.split('?id=')[1]), first.items[0].id)
page.recipeId = 'missing'
await page.loadRecipe()
assert.ok(page.data.error)
page.onLoad({ id: '%' })
assert.equal(page.data.error, '菜谱链接格式不正确')
const camera = { x: -40, y: 20, scale: .7 }
const zoomed = zoomAt(camera, 1.2, 150, 200)
assert.ok(Math.abs((150 - camera.x) / camera.scale - (150 - zoomed.x) / zoomed.scale) < 1e-8)
assert.ok(Math.abs((200 - camera.y) / camera.scale - (200 - zoomed.y) / zoomed.scale) < 1e-8)
assert.equal(zoomAt(camera, 10, 0, 0).scale, 1.6)
assert.equal(zoomAt(camera, 0, 0, 0).scale, .45)
require(path.join(root, 'dist/pages/blueprint/index.js'))
const blueprint = { ...pageDefinition, data: { ...pageDefinition.data }, setData(patch) { Object.assign(this.data, patch) } }
await blueprint.onLoad({ id: encodeURIComponent(first.items[0].id) })
assert.equal(blueprint.data.error, '')
blueprint.selectStep(0, false)
assert.equal(blueprint.data.activeIndex, 0)
assert.ok(blueprint.data.nodes.find(node => node.id === blueprint.recipe.steps[0].id).active)
for (const id of blueprint.recipe.steps[0].uses) assert.ok(blueprint.data.nodes.find(node => node.id === id)?.active)
blueprint.nextStep()
assert.equal(blueprint.data.activeIndex, Math.min(1, blueprint.data.total - 1))
assert.ok(blueprint.data.x < 0, 'step navigation must center the step column')
assert.ok(blueprint.onShareAppMessage().path.startsWith('/pages/blueprint/index?id='))
blueprint.onUnload()
const pendingRenders = []
const synchronized = { ...blueprint, data: { ...blueprint.data, surfaceTop: 0, surfaceHeight: 1800 }, disposed: false, cameraInFlight: false,
  targetCamera: null, surfaceDrawn: false, viewport: { width: 390, height: 600, left: 0, top: 100 },
  setData(patch, callback) { Object.assign(this.data, patch); pendingRenders.push(callback) },
}
synchronized.moveCamera({ x: -100, y: -200, scale: .6 })
synchronized.moveCamera({ x: -100, y: -300, scale: .6 })
assert.equal(pendingRenders.length, 1, 'gesture updates must coalesce while native rendering is pending')
const originalConnections = synchronized.data.connectionsSrc
assert.ok(originalConnections.startsWith('data:image/svg+xml;base64,'))
pendingRenders.shift()()
assert.equal(pendingRenders.length, 1, 'the latest camera must render after the pending update')
pendingRenders.shift()()
assert.equal(synchronized.renderedCamera.y, -300)
assert.equal(synchronized.data.connectionsSrc, originalConnections, 'ordinary panning must retain the same vector image as the nodes move')
const vector = connectionsSvg(synchronized.graph, 0, synchronized.graph.height, .6, -1)
assert.equal((vector.match(/<path /g) || []).length, synchronized.graph.edges.length)
assert.ok(!vector.includes('NaN') && !vector.includes('Infinity'))
assert.equal(Buffer.from(svgDataUrl(vector).split(',')[1], 'base64').toString('ascii'), vector)
assert.ok(connectionsSvg(synchronized.graph, 256, 800, 1, 0).includes('viewBox="0 256 584 800"'))
assert.ok(connectionsSvg(synchronized.graph, 0, synchronized.graph.height, 1, 0).includes('stroke="#a7843f"'))
for (const ascii of ['a', 'ab', 'abc', vector]) assert.equal(svgDataUrl(ascii), `data:image/svg+xml;base64,${Buffer.from(ascii).toString('base64')}`)
for (const scale of [.45, .6, 1, 1.6]) {
  const constrained = constrainCamera({ x: 1e6, y: -1e6, scale }, synchronized.graph, synchronized.viewport)
  assert.ok(constrained.x <= Math.max(24, (synchronized.viewport.width - synchronized.graph.width * scale) / 2 + 24) && constrained.y >= synchronized.viewport.height - synchronized.graph.height * scale - 24)
}
const touch = (x, y) => ({ touches: [{ clientX: x, clientY: y }] })
synchronized.onTouchStart(touch(100, 200))
synchronized.onTouchMove(touch(100, 230))
const beforeReverse = synchronized.camera().y
synchronized.onTouchMove(touch(100, 220))
assert.equal(synchronized.camera().y, beforeReverse - 10, 'reversing a drag must respond without a dead zone')
assert.ok(synchronized.tapSuppressedUntil > Date.now(), 'dragging must not select a node on touch end')
await blueprint.onLoad({ id: '%' })
assert.ok(blueprint.data.error)
let destination = ''
globalThis.wx.redirectTo = ({ url }) => { destination = url }
const { switchView } = require(path.join(root, 'dist/services/recipe-navigation.js'))
switchView.call({ recipeId: first.items[0].id, data: { currentView: 'recipe' } }, { currentTarget: { dataset: { view: 'cook' } } })
assert.equal(destination, `/pages/cook/index?id=${encodeURIComponent(first.items[0].id)}`)
destination = ''
switchView.call({ recipeId: first.items[0].id, data: { currentView: 'cook' } }, { currentTarget: { dataset: { view: 'cook' } } })
assert.equal(destination, '', 'active tab should not reload')
const storage = new Map()
Object.assign(globalThis.wx, { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), pageScrollTo() {} })
require(path.join(root, 'dist/pages/cook/index.js'))
const cook = { ...pageDefinition, data: { ...pageDefinition.data }, setData(patch) { Object.assign(this.data, patch) } }
cook.recipeId = first.items[0].id
await cook.loadRecipe()
assert.equal(cook.data.stepIndex, 0)
cook.previousStep()
assert.equal(cook.data.stepIndex, 0)
cook.nextStep()
const savedIndex = cook.data.stepIndex
cook.showStep(0)
await cook.loadRecipe()
assert.equal(cook.data.stepIndex, savedIndex, 'switching views should restore the saved step')
assert.ok(cook.data.supplies.every(item => cook.data.step.uses.includes(item.id)))
while (!cook.data.completed) cook.nextStep()
await cook.loadRecipe()
assert.equal(cook.data.completed, true, 'completion should persist')
cook.restart()
assert.equal(cook.data.completed, false)
assert.equal(cook.data.stepIndex, 0)
assert.equal(storage.get(`cook:${cook.recipeId}`).completed, false)
assert.ok(cook.onShareAppMessage().path.startsWith('/pages/cook/index?id='))
let fontLoads = 0
globalThis.wx.loadBuiltInFontFace = options => {
  fontLoads++
  assert.equal(options.source, 'WeChatSansStd')
  assert.equal(options.family, 'HowToCookWeChat')
  assert.equal(options.global, true)
  options.success({})
}
const fontModule = path.join(root, 'dist/services/wechat-font.js')
const { ensureWeChatFont } = require(fontModule)
assert.deepEqual(await Promise.all([ensureWeChatFont(), ensureWeChatFont()]), [true, true])
assert.equal(fontLoads, 1, 'app and blueprint must share one font load')
delete require.cache[require.resolve(fontModule)]
delete globalThis.wx.loadBuiltInFontFace
assert.equal(await require(fontModule).ensureWeChatFont(), false, 'old clients should retain system fallback')
// Reproduce a native font API that never calls back: the graph must still draw.
require(fontModule).ensureWeChatFont = () => new Promise(() => {})
const blueprintModule = path.join(root, 'dist/pages/blueprint/index.js')
delete require.cache[require.resolve(blueprintModule)]
require(blueprintModule)
const independent = { ...pageDefinition, data: { ...pageDefinition.data },
  setData(patch, callback) { Object.assign(this.data, patch); callback?.() },
  createSelectorQuery() {
    let all = false
    const query = { select() { return query }, selectAll() { all = true; return query }, boundingClientRect() { return query },
      exec(callback) {
        callback([all ? independent.data.nodes.map(node => ({ dataset: { id: node.id }, height: node.height })) : { width: 390, height: 600, left: 0, top: 48 }])
      },
    }
    return query
  },
}
globalThis.wx.nextTick = callback => callback()
await independent.onLoad({ id: encodeURIComponent(first.items[0].id) })
independent.onReady()
assert.ok(independent.data.connectionsSrc.startsWith('data:image/svg+xml;base64,'), 'a stalled font must not prevent connections from being generated')
assert.ok(independent.data.surfaceHeight > 1)
independent.onUnload()
console.log(`Verified all ${manifest.count} recipes against source Markdown, pagination, search, detail, blueprint, navigation, progress, image exclusion and package budget: ${bytes} bytes.`)
