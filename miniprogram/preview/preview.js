// Local-only visual adapter, not part of the uploaded mini program.
const app = document.querySelector('#app')
const title = document.querySelector('.nav-title')
const modules = new Map()
let current, template
const evaluate = (expression, scope) => Function('scope', `with(scope){return (${expression})}`)(scope)
const interpolate = (text, scope) => text.replace(/{{([\s\S]*?)}}/g, (_, expression) => String(evaluate(expression, scope) ?? ''))
const truth = (value, scope) => value.startsWith('{{') ? Boolean(evaluate(value.slice(2, -2), scope)) : Boolean(value)

async function loadModule(url) {
  if (modules.has(url)) return modules.get(url)
  const source = await (await fetch(url)).text()
  const dependencies = {}
  for (const match of source.matchAll(/require\("([^\"]+)"\)/g)) {
    const dependency = new URL(`${match[1]}.js`, location.origin + url).pathname
    dependencies[match[1]] = await loadModule(dependency)
  }
  const exports = {}
  Function('exports', 'require', source)(exports, name => dependencies[name])
  modules.set(url, exports)
  return exports
}

function renderChildren(parent, scope) {
  let branchActive = false
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) { node.textContent = interpolate(node.textContent, scope); continue }
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    if (node.hasAttribute('wx:for')) {
      const values = evaluate(node.getAttribute('wx:for').slice(2, -2), scope)
      const fragment = document.createDocumentFragment()
      values.forEach((value, index) => {
        const clone = node.cloneNode(true)
        const nested = { ...scope, [node.getAttribute('wx:for-item') || 'item']: value, [node.getAttribute('wx:for-index') || 'index']: index }
        clone.removeAttribute('wx:for')
        const wrapper = document.createElement('div')
        wrapper.append(clone)
        renderChildren(wrapper, nested)
        fragment.append(...wrapper.childNodes)
      })
      node.replaceWith(fragment)
      continue
    }
    if (node.hasAttribute('wx:if')) {
      branchActive = truth(node.getAttribute('wx:if'), scope)
      if (!branchActive) { node.remove(); continue }
    } else if (node.hasAttribute('wx:elif')) {
      const visible = !branchActive && truth(node.getAttribute('wx:elif'), scope)
      branchActive ||= visible
      if (!visible) { node.remove(); continue }
    } else if (node.hasAttribute('wx:else')) {
      if (branchActive) { node.remove(); continue }
      branchActive = true
    } else branchActive = false
    for (const attribute of [...node.attributes]) {
      if (!attribute.name.startsWith('wx:')) node.setAttribute(attribute.name, interpolate(attribute.value, scope))
    }
    if (node.getAttribute('disabled') === 'false') node.removeAttribute('disabled')
    for (const [attribute, event] of [['bindtap', 'click'], ['bindinput', 'input']]) {
      const handler = node.getAttribute(attribute)
      if (handler) node.addEventListener(event, () => current[handler]({ detail: { value: node.value }, currentTarget: { dataset: { ...node.dataset } } }))
    }
    if (node.getAttribute('open-type') === 'share') node.addEventListener('click', () => {
      const share = current.onShareAppMessage()
      toast(`分享入口：${share.title}（微信内验证实际分享）`)
    })
    if (node.tagName === 'PROGRESS') {
      node.max = 100
      node.value = Number(node.getAttribute('percent'))
      node.style.width = '100%'
      node.style.height = '3px'
      node.style.accentColor = '#7a2e26'
    }
    renderChildren(node, scope)
  }
}

function render() {
  const scrollPosition = document.querySelector('.categories')?.scrollLeft || 0
  const focused = document.activeElement?.matches('input')
  const selection = focused ? document.activeElement.selectionStart : null
  const host = document.createElement('div')
  host.innerHTML = template
  renderChildren(host, current.data)
  app.replaceChildren(...host.childNodes)
  const categories = document.querySelector('.categories')
  if (categories) categories.scrollLeft = scrollPosition
  if (focused) { const input = app.querySelector('input'); input?.focus(); if (selection !== null) input?.setSelectionRange(selection, selection) }
}
function toast(message) {
  document.querySelector('.toast')?.remove()
  const element = document.createElement('div'); element.className = 'toast'; element.textContent = message
  document.body.append(element); setTimeout(() => element.remove(), 3000)
}
globalThis.Page = definition => { current = { ...definition, data: structuredClone(definition.data), setData(patch, callback) { Object.assign(this.data, patch); render(); if (callback) setTimeout(callback) }, createSelectorQuery: selectorQuery } }
globalThis.wx = {
  nextTick(callback) { setTimeout(callback) },
  getWindowInfo() { return { pixelRatio: devicePixelRatio } },
  setNavigationBarTitle({ title: text }) { title.textContent = text },
  navigateTo({ url }) {
    location.hash = url
  },
  reLaunch({ url }) { location.hash = url },
  redirectTo({ url }) {
    location.hash = url
  },
  getStorageSync(key) { return JSON.parse(localStorage.getItem(key) || 'null') },
  setStorageSync(key, value) { localStorage.setItem(key, JSON.stringify(value)) },
  showToast({ title }) { toast(title) },
  pageScrollTo() { window.scrollTo(0, 0) },
  setClipboardData({ data }) { navigator.clipboard.writeText(data).then(() => toast('原文链接已复制')).catch(() => toast(data)) },
}
const styles = await (await fetch('/dist/app.wxss')).text()
document.querySelector('#native-style').textContent = styles.replace(/([\d.]+)rpx/g, (_, value) => `${Number(value) * .5}px`).replace(/^page(?=\s*\{)/gm, '.phone')
async function navigate() {
  const url = new URL(location.hash.slice(1) || '/pages/index/index', location.origin)
  const page = url.pathname === '/pages/recipe/index' ? 'recipe' : url.pathname === '/pages/cook/index' ? 'cook' : url.pathname === '/pages/blueprint/index' ? 'blueprint' : 'index'
  current?.onUnload?.()
  document.body.dataset.page = page
  template = await (await fetch(`/dist/pages/${page}/index.wxml`)).text()
  template = template.replace(/<image\b([^>]*?)\/>/g, '<img$1>')
  template = template.replace(/<progress([^>]*?)\/>/g, '<progress$1></progress>')
  const tabs = await (await fetch('/dist/templates/recipe-tabs.wxml')).text()
  template = template.replace(/<include\s+src="[^"]*recipe-tabs.wxml"\s*\/>/g, tabs)
  document.querySelector('#page-style')?.remove()
  const pageStyleResponse = await fetch(`/dist/pages/${page}/index.wxss`)
  if (pageStyleResponse.ok) {
    const style = document.createElement('style'); style.id = 'page-style'
    style.textContent = (await pageStyleResponse.text()).replace(/([\d.]+)rpx/g, (_, value) => `${Number(value) * .5}px`).replace(/^page(?=\s*\{)/gm, '.phone')
    document.head.append(style)
  }
  // Reexecute page registration on every navigation; data modules stay cached.
  modules.delete(`/dist/pages/${page}/index.js`)
  await loadModule(`/dist/pages/${page}/index.js`)
  if (page === 'index') title.textContent = '赛博菜谱'
  render()
  await current.onLoad(Object.fromEntries(url.searchParams))
  current.onReady?.()
  window.scrollTo(0, 0)
}
document.querySelector('#back').onclick = () => { location.hash = '/pages/index/index' }
window.addEventListener('hashchange', () => navigate().catch(error => toast(error.message)))
await navigate()

function selectorQuery() {
  const operations = []
  let selector, all
  const query = {
    select(value) { selector = value; all = false; return query },
    selectAll(value) { selector = value; all = true; return query },
    boundingClientRect() { operations.push({ selector, all, rect: true }); return query },
    fields() { operations.push({ selector, all, rect: false }); return query },
    exec(callback) {
      setTimeout(() => callback(operations.map(operation => {
        const read = node => { const r = node.getBoundingClientRect(); return { node, left: r.left, top: r.top, width: r.width, height: r.height, dataset: { ...node.dataset } } }
        if (operation.all) return [...app.querySelectorAll(operation.selector)].map(read)
        const node = app.querySelector(operation.selector)
        return node ? read(node) : null
      })))
    },
  }
  return query
}
const pointers = new Map()
const touchEvent = () => ({ touches: [...pointers.values()] })
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.graph-viewport')) return
  pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
  current.onTouchStart(touchEvent())
})
document.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return
  pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
  current.onTouchMove(touchEvent())
})
for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, event => {
  if (!pointers.delete(event.pointerId)) return
  current.onTouchEnd(touchEvent())
})

window.addEventListener('scroll', () => {
  if (document.documentElement.scrollHeight - innerHeight - scrollY < 160) current?.onReachBottom?.()
}, { passive: true })
