/**
 * 菜谱蓝图 · 链接预览 Worker
 *
 * 站点本身是纯静态资源（Vite 构建产物，由 Workers Static Assets 托管）。
 * 站内路由用 #hash，而聊天软件 / 社交平台抓取链接预览时既不执行 JS，也看不到 # 之后的内容，
 * 所以给每道菜提供分享短链 /r/<菜谱 id>，由这里返回带该菜谱标题、简介、成品图的 index.html；
 * 真实访客打开后，前端（src/main.tsx）再把地址改写成 /#text/<菜谱 id>。
 *
 * 只有 wrangler.jsonc 里 run_worker_first 列出的路径（/ 和 /r/*）会进入这里，其余请求直接走静态资源。
 */

const SITE = {
  title: '菜谱蓝图 · 程序员做饭指南',
  description: '364 道家常菜，画成一张张蓝图：原料连到步骤，跟着做不漏料。支持蓝图、图文和烹饪模式。',
  image: '/og.png',
}

/** 同一个 isolate 内缓存菜谱数据，避免每次请求都解析 1MB+ 的 JSON */
let recipesPromise = null
function loadRecipes(env, origin) {
  recipesPromise ??= env.ASSETS.fetch(new URL('/data/recipes.json', origin))
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => {
      recipesPromise = null
      return []
    })
  return recipesPromise
}

const clip = (s, n) => {
  const t = (s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

export default {
  /** @param {Request} request @param {{ ASSETS: { fetch: typeof fetch } }} env */
  async fetch(request, env) {
    const url = new URL(request.url)
    const page = await env.ASSETS.fetch(new URL('/', url.origin))
    if (!page.ok || !(page.headers.get('content-type') || '').includes('text/html')) return page

    const meta = { ...SITE, url: url.origin + '/' }
    const share = url.pathname.match(/^\/r\/(.+)$/)
    if (share) {
      let id = share[1]
      try {
        id = decodeURIComponent(id)
      } catch {
        /* 保留原样 */
      }
      const recipe = (await loadRecipes(env, url.origin)).find((r) => r.id === id)
      if (recipe) {
        const facts = [recipe.categoryName, recipe.calories, `${recipe.steps.length} 步`].filter(Boolean).join(' · ')
        meta.title = `${recipe.name}的做法 · 菜谱蓝图`
        meta.description = clip(recipe.description, 90) || `${recipe.name}：${facts}`
        meta.image = recipe.cover ? '/' + recipe.cover : SITE.image
        meta.url = url.origin + url.pathname
      }
    }
    const abs = (p) => (/^https?:/.test(p) ? p : url.origin + p)

    const set = (attr, value) => ({
      element(el) {
        el.setAttribute(attr, value)
      },
    })
    const rewritten = new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(meta.title)
        },
      })
      .on('meta[name="description"]', set('content', meta.description))
      .on('meta[property="og:title"]', set('content', meta.title))
      .on('meta[property="og:description"]', set('content', meta.description))
      .on('meta[property="og:image"]', set('content', abs(meta.image)))
      .on('meta[property="og:url"]', set('content', meta.url))
      .on('meta[itemprop="name"]', set('content', meta.title))
      .on('meta[itemprop="description"]', set('content', meta.description))
      .on('meta[itemprop="image"]', set('content', abs(meta.image)))
      .transform(page)

    const headers = new Headers(rewritten.headers)
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
    return new Response(rewritten.body, { status: 200, headers })
  },
}
