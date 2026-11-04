// 将 ../dishes 下的 Markdown 菜谱解析为结构化 JSON，供前端各种视图使用。
// 输出：public/data/recipes.json，以及菜谱引用的图片 public/images/...
//
// 图片在仓库中以 Git LFS 存储。本地或构建环境没有拉取 LFS 时，文件只是指针，
// 此时从 GitHub 的 LFS 媒体地址下载真实文件（校验 sha256，并缓存到 .cache/lfs）。
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
const dishesDir = path.join(repoRoot, 'dishes')
const outDir = path.resolve(here, '../public')
const lfsCacheDir = path.resolve(here, '../.cache/lfs')
// LFS 媒体地址：<base>/dishes/<相对路径>，可通过环境变量覆盖仓库与分支
const LFS_MEDIA_BASE =
  process.env.LFS_MEDIA_BASE ?? 'https://media.githubusercontent.com/media/zcq100/HowToCook/zcq100'

/** 待复制 / 下载的图片：输出相对路径 -> 来源信息 */
const imageJobs = new Map()

// 逐段编码路径，但保留 “+”：Vite 开发服务器不会把 %2B 还原成 +
const encodePath = (rel) => rel.split('/').map((seg) => encodeURIComponent(seg).replace(/%2B/g, '+')).join('/')

const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

/** 把 Markdown 中的图片路径解析为站点内 URL；外链原样保留；找不到文件返回 null */
function resolveImage(mdFile, src) {
  if (/^https?:\/\//.test(src)) return src
  let decoded
  try {
    decoded = decodeURI(src)
  } catch {
    decoded = src
  }
  const abs = path.resolve(path.dirname(mdFile), decoded)
  if (!abs.startsWith(dishesDir + path.sep) || !fs.existsSync(abs)) return null
  const rel = path.relative(dishesDir, abs).split(path.sep).join('/')
  imageJobs.set(rel, abs)
  return 'images/' + encodePath(rel)
}

/** 将一段 Markdown 中的图片引用改写为解析后的 URL，无法解析的直接移除 */
const rewriteImages = (mdFile, text) =>
  text.replace(IMG_RE, (_, alt, src) => {
    const url = resolveImage(mdFile, src)
    return url ? `![${alt}](${url})` : ''
  })

const CATEGORY_NAMES = {
  vegetable_dish: '素菜',
  meat_dish: '荤菜',
  aquatic: '水产',
  breakfast: '早餐',
  staple: '主食',
  'semi-finished': '半成品加工',
  soup: '汤与粥',
  drink: '饮料',
  condiment: '酱料和其它材料',
  dessert: '甜品',
}

const TOOL_KEYWORDS = [
  '锅', '烤箱', '微波炉', '刀', '砧板', '案板', '碗', '盆', '盘', '筷', '铲', '勺', '漏勺',
  '模具', '料理机', '破壁机', '搅拌机', '榨汁机', '电饭煲', '蒸笼', '蒸架', '保鲜膜', '锡纸',
  '油纸', '烘焙纸', '打蛋器', '量杯', '量勺', '电子秤', '厨房秤', '牙签', '吸油纸', '厨房纸',
  '温度计', '擀面杖', '空气炸锅', '筛', '滤网', '纱布', '密封', '保鲜盒', '杯', '瓶', '夹子',
  '剪刀', '刷子', '烤盘', '蒸锅', '高压锅', '砂锅', '平底锅', '炒锅', '奶锅', '冰箱', '冰格',
]
// 不应被识别为工具的食材（包含工具关键字但其实是食物）
const NOT_TOOL = ['锅巴', '火锅底料', '杯子蛋糕', '刀鱼', '盘龙']

// 常见单字食材：当原料名以这些字结尾时，将该单字作为匹配别名（例如 “小葱” 匹配步骤中的 “葱结”）
const SINGLE_CHAR_ALIASES = ['葱', '姜', '蒜', '盐', '糖', '醋', '蛋', '酒']
// 名称包含即追加的别名（“蒜瓣”“姜末”在步骤里常被简写成 “蒜”“姜”）
const CONTAINS_ALIASES = ['葱', '姜', '蒜']
// 同义词：原料名 -> 步骤里常见的叫法
const SYNONYMS = {
  食用油: ['油'], 菜籽油: ['油'], 花生油: ['油'], 玉米油: ['油'], 植物油: ['油'], 色拉油: ['油'],
  清水: ['水'], 饮用水: ['水'], 纯净水: ['水'],
  淀粉: ['生粉', '水淀粉'], 玉米淀粉: ['淀粉', '生粉'], 生粉: ['淀粉'],
  酱油: ['生抽'], 鸡精: ['味精'], 味精: ['鸡精'],
}

// 原料名常见的修饰性前缀，截断原料名生成别名时跳过
const GENERIC_PREFIXES = new Set(['食用', '新鲜', '冷冻', '干货', '优质', '有机', '普通', '少许', '适量', '鲜榨', '纯净', '原味', '大号', '小号', '中号'])

const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '')
const stripMd = (s) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()

function splitSections(md) {
  const sections = { _head: [] }
  let cur = '_head'
  for (const line of md.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      cur = m[1]
      sections[cur] = []
    } else {
      sections[cur].push(line)
    }
  }
  return sections
}

// 解析列表：返回顶层条目，缩进的子条目作为 notes 挂在上一条上
function parseList(lines, { ordered = false } = {}) {
  const items = []
  const extra = []
  for (const raw of lines) {
    if (!raw.trim()) continue
    const indent = raw.match(/^\s*/)[0].length
    const top = ordered ? raw.match(/^(\d+)[.、)]\s*(.*)$/) : raw.match(/^[*\-+]\s+(.*)$/)
    if (top && indent === 0) {
      items.push({ text: (ordered ? top[2] : top[1]).trim(), notes: [] })
      continue
    }
    // 列表之间单独成行的图片，归到上一条（常见于“操作”里每步后附图）
    if (items.length && /^!\[/.test(raw.trim())) {
      items[items.length - 1].notes.push(raw.trim())
      continue
    }
    const sub = raw.match(/^\s*(?:[*\-+]|\d+[.、)])\s+(.*)$/)
    const text = (sub ? sub[1] : raw).trim()
    if (items.length && (indent > 0 || sub)) items[items.length - 1].notes.push(text)
    else extra.push(text)
  }
  return { items, extra }
}

function nameAliases(name) {
  const base = stripMd(name).replace(/[（(][^）)]*[）)]/g, '').trim()
  const parts = base.split(/或|\/|、|，|,|和|与/).map((s) => s.trim()).filter(Boolean)
  const aliases = new Set()
  for (const p of parts) {
    aliases.add(p)
    // “鸡翅中” -> “鸡翅”；但 “食用盐” 截出的 “食用”、“新鲜菜心” 截出的 “新鲜” 这类修饰词不能当别名，
    // 否则 “食用盐” 会匹配到 “食用油 15ml”
    if (p.length >= 3)
      for (let len = p.length - 1; len >= 2; len--) {
        const prefix = p.slice(0, len)
        if (!GENERIC_PREFIXES.has(prefix)) aliases.add(prefix)
      }
    const last = p.at(-1)
    if (SINGLE_CHAR_ALIASES.includes(last)) aliases.add(last)
    for (const c of CONTAINS_ALIASES) if (p.includes(c)) aliases.add(c)
    for (const syn of SYNONYMS[p] ?? []) aliases.add(syn)
  }
  return [...aliases].sort((a, b) => b.length - a.length)
}

const isTool = (name) =>
  !NOT_TOOL.some((n) => name.includes(n)) && TOOL_KEYWORDS.some((k) => name.includes(k))

// 用量行里数量之前的“名称部分”：“新鲜空心菜 250 g” -> “新鲜空心菜”
const calcHead = (text) => text.split(/[\d\s=:：（(]/)[0]

// 从计算条目中取出名称部分：“可乐 500ml” -> “可乐”
const calcName = (text) => stripMd(text).split(/[\s\d:：（(约]/)[0].trim()

function extractTimes(text) {
  const re = /(\d+(?:\.\d+)?(?:\s*[-～~至到]\s*\d+(?:\.\d+)?)?)\s*(小时|分钟|分|秒|min|h|s)(?![a-z])/gi
  return [...text.matchAll(re)].map((m) => m[1].replace(/\s+/g, '') + m[2])
}
const extractHeat = (text) => {
  const m = text.match(/(中小火|中大火|大火|中火|小火|微火|文火|旺火)/)
  return m ? m[1] : null
}

function parseRecipe(file) {
  const rel = path.relative(dishesDir, file)
  const [category] = rel.split(path.sep)
  const md = stripComments(fs.readFileSync(file, 'utf8'))
  const sec = splitSections(md)

  const titleLine = sec._head.find((l) => l.startsWith('# ')) ?? ''
  const name = titleLine.replace(/^#\s+/, '').replace(/的做法$/, '').trim() || path.basename(file, '.md')

  const images = []
  const descParts = []
  let difficulty = 0
  let calories = null
  for (const line of sec._head) {
    const t = line.trim()
    if (!t || t.startsWith('# ')) continue
    for (const m of t.matchAll(IMG_RE)) images.push(m[2])
    if (t.startsWith('预估烹饪难度')) difficulty = (t.match(/★/g) || []).length
    else if (t.startsWith('预估卡路里')) calories = t.split(/[:：]/)[1]?.trim() ?? null
    else if (stripMd(t)) descParts.push(stripMd(t))
  }

  const rawIngredients = parseList(sec['必备原料和工具'] ?? []).items.map((i) => stripMd(i.text))
  const calc = parseList(sec['计算'] ?? [])
  const calcItems = calc.items.map((i) => stripMd(i.text))
  const stepList = parseList(sec['操作'] ?? [], { ordered: true })
  const steps = stepList.items
  // 附加内容保留行内 Markdown（含图片），由前端渲染
  const tips = parseList(sec['附加内容'] ?? []).items
    .flatMap((i) => [i.text, ...i.notes])
    .map((t) => rewriteImages(file, t).trim())
    .filter((t) => t && !t.startsWith('如果您遵循本指南'))
  // 附加内容中单独成行（不在列表里）的图片
  const tipImages = parseList(sec['附加内容'] ?? []).extra

  // 原料节点：必备原料 + 计算中额外出现的原料
  const usedCalc = new Set()
  const ingredients = expandIngredients(rawIngredients).map(({ label, tool }, idx) => {
    const aliases = nameAliases(label)
    // 优先匹配“名称部分”（数量之前）含原料名的用量行；都不匹配时才退回到整行包含。
    // 这样 “食用油 300ml（土豆能浮在油上面即可）” 不会被算作土豆的用量
    const matches = (text) =>
      aliases.some((a) => a.length >= 2 && text.includes(a)) || text.startsWith(aliases.at(-1) ?? '\u0000')
    let hits = calcItems.map((c, ci) => [c, ci]).filter(([c]) => matches(calcHead(c)))
    if (!hits.length) hits = calcItems.map((c, ci) => [c, ci]).filter(([c]) => matches(c))
    hits.forEach(([, ci]) => usedCalc.add(ci))
    const qty = hits.map(([c]) => c)
    const kind = tool || isTool(label) ? 'tool' : 'ingredient'
    return { id: `i${idx}`, name: label, kind, amounts: qty, aliases }
  })
  calcItems.forEach((c, ci) => {
    if (usedCalc.has(ci)) return
    // 只接受 “名称 + 数量” 形态的条目，过滤 “工具：”“一般一个人可以食用” 之类说明文字
    if (!/^[\u4e00-\u9fa5A-Za-z]{1,8}\s*[:：]?\s*(\d|半|一|两|少|适)/.test(c)) return
    const n = calcName(c)
    if (!n || /工具|原料|用量|份|人/.test(n)) return
    ingredients.push({
      id: `i${ingredients.length}`,
      name: n,
      kind: isTool(n) ? 'tool' : 'ingredient',
      amounts: [c],
      aliases: nameAliases(n),
      extra: true,
    })
  })

  const parsedSteps = steps.map((s, idx) => {
    const plain = stripMd(s.text + ' ' + s.notes.join(' '))
    const uses = ingredients
      .filter((ing) => ing.aliases.some((a) => plain.includes(a)))
      .map((ing) => ing.id)
    return {
      id: `s${idx}`,
      index: idx + 1,
      text: rewriteImages(file, s.text),
      notes: s.notes.map((n) => rewriteImages(file, n)).filter((n) => n.trim()),
      uses,
      times: extractTimes(plain),
      heat: extractHeat(plain),
    }
  })

  // 图集：开头的图片 + 原料/计算章节里的图片 + “操作”/“附加内容”列表之外的图片
  const looseImages = [...(sec['必备原料和工具'] ?? []), ...(sec['计算'] ?? []), ...stepList.extra, ...tipImages].flatMap((t) => [...t.matchAll(IMG_RE)].map((m) => m[2]))
  const imageUrls = [...new Set([...images, ...looseImages].map((src) => resolveImage(file, src)).filter(Boolean))]

  return {
    id: rel.replace(/\.md$/, '').split(path.sep).join('/'),
    name,
    category,
    categoryName: CATEGORY_NAMES[category] ?? category,
    description: descParts.join('\n'),
    difficulty,
    calories,
    images: imageUrls,
    servingsNote: calc.extra.map(stripMd).filter(Boolean).join(' '),
    ingredients: ingredients.map(({ aliases, ...rest }) => rest),
    steps: parsedSteps,
    tips,
  }
}

// 只在括号外按分隔符切分：“锅（砂锅、铁锅）、碗” -> ["锅（砂锅、铁锅）", "碗"]
function splitTop(text) {
  const out = []
  let depth = 0
  let buf = ''
  for (const ch of text) {
    if ('（('.includes(ch)) depth++
    if ('）)'.includes(ch)) depth = Math.max(0, depth - 1)
    if (depth === 0 && '、，,；;'.includes(ch)) {
      out.push(buf)
      buf = ''
    } else buf += ch
  }
  out.push(buf)
  return out.map((s) => s.trim()).filter(Boolean)
}

// 兼容 “主料：五花肉”“辅料：油、冰糖、老抽” 这类把多个原料写在一行的写法，并跳过 “注：” 说明
function expandIngredients(raw) {
  const out = []
  for (const item of raw) {
    if (!item || /^(注|备注|提示)[:：]/.test(item)) continue
    const m = item.match(/^(主料|辅料|配料|调料|调味料|原料|食材|工具|器具|厨具)[:：]\s*(.+)$/)
    if (m) {
      const tool = /工具|器具|厨具/.test(m[1])
      for (const label of splitTop(m[2])) out.push({ label, tool })
    } else out.push({ label: item, tool: false })
  }
  return out
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return e.name.endsWith('.md') && e.name !== 'index.md' ? [p] : []
  })
}

function lfsPointer(file) {
  const buf = fs.readFileSync(file)
  if (buf.length > 1024) return null
  const text = buf.toString('utf8')
  if (!text.startsWith('version https://git-lfs')) return null
  const oid = text.match(/oid sha256:([0-9a-f]{64})/)?.[1]
  return oid ? { oid } : null
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

/** 生成一张图片到 public/images；LFS 指针从 GitHub 下载（带缓存与校验）。返回是否成功 */
async function materialize(rel, abs) {
  const dest = path.join(outDir, 'images', ...rel.split('/'))
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const ptr = lfsPointer(abs)
  if (!ptr) {
    fs.copyFileSync(abs, dest)
    return 'local'
  }
  const cached = path.join(lfsCacheDir, ptr.oid)
  if (!fs.existsSync(cached)) {
    const url = `${LFS_MEDIA_BASE}/dishes/${rel.split('/').map(encodeURIComponent).join('/')}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (sha256(buf) !== ptr.oid) throw new Error('sha256 不匹配')
    fs.mkdirSync(lfsCacheDir, { recursive: true })
    fs.writeFileSync(cached, buf)
    fs.copyFileSync(cached, dest)
    return 'downloaded'
  }
  fs.copyFileSync(cached, dest)
  return 'cached'
}

async function materializeAll(jobs, concurrency = 8) {
  const stats = { local: 0, cached: 0, downloaded: 0 }
  const failed = new Set()
  const queue = [...jobs]
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const [rel, abs] = job
        try {
          stats[await materialize(rel, abs)]++
        } catch (e) {
          failed.add('images/' + encodePath(rel))
          console.warn(`[data] 图片获取失败，已跳过：${rel}（${e.message}）`)
        }
      }
    }),
  )
  return { stats, failed }
}

/** 从数据中移除获取失败的图片引用 */
function dropImages(recipe, failed) {
  if (!failed.size) return recipe
  const clean = (t) => t.replace(IMG_RE, (m, _alt, url) => (failed.has(url) ? '' : m))
  recipe.images = recipe.images.filter((u) => !failed.has(u))
  recipe.tips = recipe.tips.map(clean).filter((t) => t.trim())
  for (const st of recipe.steps) {
    st.text = clean(st.text)
    st.notes = st.notes.map(clean).filter((n) => n.trim())
  }
  return recipe
}

const files = walk(dishesDir).filter((f) => !f.includes(`${path.sep}template${path.sep}`))
fs.rmSync(path.join(outDir, 'images'), { recursive: true, force: true })
const parsed = files.map(parseRecipe).sort((a, b) => a.name.localeCompare(b.name, 'zh'))
const { stats, failed } = await materializeAll(imageJobs)
const recipes = parsed.map((r) => dropImages(r, failed))
fs.mkdirSync(path.join(outDir, 'data'), { recursive: true })
fs.writeFileSync(path.join(outDir, 'data', 'recipes.json'), JSON.stringify(recipes))

console.log(
  `[data] 图片 ${imageJobs.size} 张：本地 ${stats.local}，缓存 ${stats.cached}，下载 ${stats.downloaded}，失败 ${failed.size}`,
)
const withImg = recipes.filter((r) => r.images.length).length
const unlinked = recipes.reduce(
  (n, r) => n + r.ingredients.filter((i) => !r.steps.some((s) => s.uses.includes(i.id))).length,
  0,
)
console.log(`[data] ${recipes.length} 道菜谱，${withImg} 道有成品图，${unlinked} 个原料未在步骤中被识别`)
