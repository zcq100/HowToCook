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
    for (const [attribute, event] of [['bindtap', 'click'], ['bindinput', 'input']]) {
      const handler = node.getAttribute(attribute)
      if (handler) node.addEventListener(event, () => current[handler]({ detail: { value: node.value }, currentTarget: { dataset: { ...node.dataset } } }))
    }
    if (node.getAttribute('open-type') === 'share') node.addEventListener('click', () => {
      const share = current.onShareAppMessage()
      toast(`分享入口：${share.title}（微信内验证实际分享）`)
    })
    renderChildren(node, scope)
  }
}

function render() {
  const focused = document.activeElement?.matches('input')
  const selection = focused ? document.activeElement.selectionStart : null
  const host = document.createElement('div')
  host.innerHTML = template
  renderChildren(host, current.data)
  app.replaceChildren(...host.childNodes)
  if (focused) { const input = app.querySelector('input'); input?.focus(); if (selection !== null) input?.setSelectionRange(selection, selection) }
}
function toast(message) {
  document.querySelector('.toast')?.remove()
  const element = document.createElement('div'); element.className = 'toast'; element.textContent = message
  document.body.append(element); setTimeout(() => element.remove(), 3000)
}
globalThis.Page = definition => { current = { ...definition, data: structuredClone(definition.data), setData(patch) { Object.assign(this.data, patch); render() } } }
globalThis.wx = {
  setNavigationBarTitle({ title: text }) { title.textContent = text },
  navigateTo({ url }) {
    if (url.startsWith('/pages/blueprint/')) { toast('蓝图使用原生触摸与 Canvas，请在微信预览版中体验'); return }
    location.hash = url
  },
  reLaunch({ url }) { location.hash = url },
}
const styles = await (await fetch('/dist/app.wxss')).text()
document.querySelector('#native-style').textContent = styles.replace(/([\d.]+)rpx/g, (_, value) => `${Number(value) * .5}px`).replace(/\bpage(?=\s*\{)/g, '.phone')
async function navigate() {
  const url = new URL(location.hash.slice(1) || '/pages/index/index', location.origin)
  const page = url.pathname === '/pages/recipe/index' ? 'recipe' : 'index'
  template = await (await fetch(`/dist/pages/${page}/index.wxml`)).text()
  // Reexecute page registration on every navigation; data modules stay cached.
  modules.delete(`/dist/pages/${page}/index.js`)
  await loadModule(`/dist/pages/${page}/index.js`)
  if (page === 'index') title.textContent = '今天做什么'
  render()
  await current.onLoad(Object.fromEntries(url.searchParams))
  window.scrollTo(0, 0)
}
document.querySelector('#back').onclick = () => { location.hash = '/pages/index/index' }
window.addEventListener('hashchange', () => navigate().catch(error => toast(error.message)))
await navigate()
