import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const { repository } = require(path.join(root, 'dist/services/repository.js'))
const categories = await repository.listCategories()
assert.equal(categories.length, 10)
assert.equal(categories.reduce((n, c) => n + c.count, 0), 20)
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
  for (const summary of (await repository.listRecipes({ category: category.id })).items) {
    const recipe = await repository.getRecipe(decodeURIComponent(encodeURIComponent(summary.id)))
    assert.ok(recipe.steps.length)
    assert.equal(recipe.images.length, 0)
    assert.equal(recipe.cover, null)
    assert.ok(!JSON.stringify(recipe).includes('!['), 'sample must not contain Markdown images')
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
console.log(`Verified categories, pagination, search, detail, missing IDs, image exclusion and package budget: ${bytes} bytes.`)
