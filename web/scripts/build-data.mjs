// 将 ../dishes 下的 Markdown 菜谱解析为结构化 JSON，供前端各种视图使用。
// 输出：public/data/recipes.json，以及被引用且已通过 Git LFS 拉取的图片 public/assets/...
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
const dishesDir = path.join(repoRoot, 'dishes')
const outDir = path.resolve(here, '../public')

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
    // “鸡翅中” -> “鸡翅”
    if (p.length >= 3) for (let len = p.length - 1; len >= 2; len--) aliases.add(p.slice(0, len))
    const last = p.at(-1)
    if (SINGLE_CHAR_ALIASES.includes(last)) aliases.add(last)
    for (const c of CONTAINS_ALIASES) if (p.includes(c)) aliases.add(c)
    for (const syn of SYNONYMS[p] ?? []) aliases.add(syn)
  }
  return [...aliases].sort((a, b) => b.length - a.length)
}

const isTool = (name) =>
  !NOT_TOOL.some((n) => name.includes(n)) && TOOL_KEYWORDS.some((k) => name.includes(k))

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
    for (const m of t.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) images.push(m[1])
    if (t.startsWith('预估烹饪难度')) difficulty = (t.match(/★/g) || []).length
    else if (t.startsWith('预估卡路里')) calories = t.split(/[:：]/)[1]?.trim() ?? null
    else if (stripMd(t)) descParts.push(stripMd(t))
  }

  const rawIngredients = parseList(sec['必备原料和工具'] ?? []).items.map((i) => stripMd(i.text))
  const calc = parseList(sec['计算'] ?? [])
  const calcItems = calc.items.map((i) => stripMd(i.text))
  const steps = parseList(sec['操作'] ?? [], { ordered: true }).items
  const tips = parseList(sec['附加内容'] ?? []).items
    .map((i) => stripMd(i.text))
    .filter((t) => !t.startsWith('如果您遵循本指南'))

  // 原料节点：必备原料 + 计算中额外出现的原料
  const usedCalc = new Set()
  const ingredients = expandIngredients(rawIngredients).map(({ label, tool }, idx) => {
    const aliases = nameAliases(label)
    const qty = calcItems.filter((c, ci) => {
      const hit = aliases.some((a) => a.length >= 2 && c.includes(a)) || c.startsWith(aliases.at(-1) ?? '\u0000')
      if (hit) usedCalc.add(ci)
      return hit
    })
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
      text: s.text,
      notes: s.notes,
      uses,
      times: extractTimes(plain),
      heat: extractHeat(plain),
    }
  })

  // 图片：仅保留已从 LFS 拉取的真实文件
  const imageUrls = []
  for (const img of images) {
    const src = path.resolve(path.dirname(file), decodeURI(img))
    if (!fs.existsSync(src)) continue
    const head = fs.readFileSync(src).subarray(0, 40).toString()
    if (head.startsWith('version https://git-lfs')) continue
    const dest = path.join(outDir, 'images', path.relative(dishesDir, src))
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
    imageUrls.push('images/' + path.relative(dishesDir, src).split(path.sep).join('/'))
  }

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

const files = walk(dishesDir).filter((f) => !f.includes(`${path.sep}template${path.sep}`))
fs.rmSync(path.join(outDir, 'images'), { recursive: true, force: true })
const recipes = files.map(parseRecipe).sort((a, b) => a.name.localeCompare(b.name, 'zh'))
fs.mkdirSync(path.join(outDir, 'data'), { recursive: true })
fs.writeFileSync(path.join(outDir, 'data', 'recipes.json'), JSON.stringify(recipes))

const withImg = recipes.filter((r) => r.images.length).length
const unlinked = recipes.reduce(
  (n, r) => n + r.ingredients.filter((i) => !r.steps.some((s) => s.uses.includes(i.id))).length,
  0,
)
console.log(`[data] ${recipes.length} 道菜谱，${withImg} 道含已拉取图片，${unlinked} 个原料未在步骤中被识别`)
