import QRCode from 'qrcode'
import type { Recipe } from './types'

/** 分享短链：/r/<菜谱 id>，由 worker/index.js 为链接预览改写 meta，前端再跳到 /#text/<id> */
export const shareUrl = (recipe: Recipe) =>
  `${location.origin}/r/${recipe.id.split('/').map(encodeURIComponent).join('/')}`

// 分享卡片固定用“典藏”风格，与当前主题无关
const W = 1080
const H = 1440
const SERIF = `Georgia, 'Source Han Serif SC', 'Source Han Serif CN', '思源宋体 CN', 'Noto Serif CJK SC', 'Noto Serif SC', 'Songti SC', STSong, 'Noto Serif SC Variable', serif`
const SANS = `-apple-system, 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif`
const C = {
  desk: '#efe4cc',
  paper: '#fffbf2',
  mat: '#fffdf8',
  ink: '#1f1812',
  body: '#3b3127',
  muted: '#86765e',
  wine: '#7a2e26',
  gold: '#a7843f',
  goldSoft: 'rgba(167,132,63,.55)',
}

/** 页脚分隔线位置：上方是正文，下方是二维码和说明 */
const FOOT_Y = 1160

const font = (weight: number, size: number, family = SERIF) => `${weight} ${size}px ${family}`

const NO_LINE_START = '、，。；：！？）」』】》…·,.;:!?)'

/** 按字符折行（中文没有空格分词）；超出 maxLines 时末行加省略号 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    // 避头标点（、，。等）不放在行首：挂在上一行末尾
    if (ctx.measureText(line + ch).width > maxWidth && line && !NO_LINE_START.includes(ch)) {
      lines.push(line)
      line = ch
      if (lines.length === maxLines) break
    } else line += ch
  }
  if (lines.length < maxLines && line) lines.push(line)
  const used = lines.join('').length
  if (used < [...text].length && lines.length) {
    let last = lines[lines.length - 1]
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1)
    lines[lines.length - 1] = last + '…'
  }
  return lines
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
  return y + lines.length * lineHeight
}

/** 双细线（菜单里的分隔线） */
function doubleRule(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  ctx.strokeStyle = C.goldSoft
  ctx.lineWidth = 1.5
  for (const dy of [-2.5, 2.5]) {
    ctx.beginPath()
    ctx.moveTo(x1, y + dy)
    ctx.lineTo(x2, y + dy)
    ctx.stroke()
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** 等字体（含 iOS 上的网络衬线字体分片）就绪，否则画布会先用后备字体画出来 */
async function ensureFonts(text: string) {
  try {
    await Promise.all([
      document.fonts.load(font(600, 76), text),
      document.fonts.load(font(400, 30), text),
      document.fonts.load(font(500, 30, SANS), text),
    ])
  } catch {
    /* 字体加载失败时用后备字体继续 */
  }
}

/** 生成分享卡片 PNG */
export async function renderShareCard(recipe: Recipe): Promise<Blob> {
  const url = shareUrl(recipe)
  const ingredients = recipe.ingredients.filter((i) => i.kind === 'ingredient').map((i) => i.name.replace(/[（(][^）)]*[）)]/g, '').trim())
  const facts = ['★'.repeat(recipe.difficulty) + '☆'.repeat(Math.max(0, 5 - recipe.difficulty)), recipe.calories, recipe.categoryName, `${recipe.steps.length} 步`]
    .filter(Boolean)
    .join('  ·  ')
  await ensureFonts(`菜谱蓝图${recipe.name}❦${facts}主要原料${ingredients.join('、')}${recipe.description}扫码查看完整做法蓝图图文烹饪模式${location.host}`)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  // 桌面 + 纸页 + 双线边框
  ctx.fillStyle = C.desk
  ctx.fillRect(0, 0, W, H)
  ctx.shadowColor = 'rgba(70,50,20,.18)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 14
  ctx.fillStyle = C.paper
  ctx.fillRect(40, 40, W - 80, H - 80)
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = C.goldSoft
  ctx.lineWidth = 2
  ctx.strokeRect(40, 40, W - 80, H - 80)
  ctx.lineWidth = 1.5
  ctx.strokeRect(56, 56, W - 112, H - 112)

  const cx = W / 2
  const contentW = 860
  ctx.textAlign = 'center'

  // 页眉：图标 + 站名
  const icon = await loadImage('/favicon.svg')
  ctx.font = font(600, 32)
  const brand = '菜 谱 蓝 图'
  const brandW = ctx.measureText(brand).width
  const iconS = 44
  const bx = cx - (brandW + iconS + 14) / 2
  if (icon) ctx.drawImage(icon, bx, 92, iconS, iconS)
  ctx.fillStyle = C.wine
  ctx.textAlign = 'left'
  ctx.fillText(brand, bx + iconS + 14, 126)
  ctx.textAlign = 'center'

  let y = 176
  const cover = recipe.cover ? await loadImage('/' + recipe.cover) : null
  if (cover) {
    // 成品图：白色卡纸 + 细金边，按 cover 方式裁切
    const fx = 110
    const fw = W - 220
    const fh = 560
    ctx.fillStyle = C.mat
    ctx.shadowColor = 'rgba(70,50,20,.14)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 6
    ctx.fillRect(fx, y, fw, fh)
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = C.goldSoft
    ctx.lineWidth = 1.5
    ctx.strokeRect(fx, y, fw, fh)
    const pad = 14
    const iw = fw - pad * 2
    const ih = fh - pad * 2
    const scale = Math.max(iw / cover.width, ih / cover.height)
    const sw = iw / scale
    const sh = ih / scale
    ctx.drawImage(cover, (cover.width - sw) / 2, (cover.height - sh) / 2, sw, sh, fx + pad, y + pad, iw, ih)
    y += fh + 104
  } else {
    y += 150
  }

  // 菜名：过长时缩小字号
  let size = 80
  ctx.font = font(600, size)
  while (ctx.measureText(recipe.name).width > contentW && size > 52) ctx.font = font(600, (size -= 4))
  ctx.fillStyle = C.ink
  const titleLines = wrap(ctx, recipe.name, contentW, 2)
  const lineH = size * 1.2
  drawLines(ctx, titleLines, cx, y, lineH)
  y += (titleLines.length - 1) * lineH // y = 最后一行菜名的基线

  ctx.font = font(400, 34)
  ctx.fillStyle = C.gold
  ctx.fillText('❦', cx, y + 58)

  ctx.font = font(400, 30)
  ctx.fillStyle = C.muted
  ctx.fillText(facts, cx, y + 116)
  y += 182

  // 没有图片时用简介填充版面
  if (!cover && recipe.description) {
    ctx.font = font(400, 34)
    ctx.fillStyle = C.body
    y = drawLines(ctx, wrap(ctx, recipe.description, contentW - 40, 5), cx, y + 10, 58) + 40
  }

  if (ingredients.length) {
    doubleRule(ctx, cx - 260, cx - 90, y - 10)
    doubleRule(ctx, cx + 90, cx + 260, y - 10)
    ctx.font = font(600, 28)
    ctx.fillStyle = C.wine
    ctx.fillText('主要原料', cx, y)
    ctx.font = font(400, 32)
    ctx.fillStyle = C.body
    // 原料行必须落在页脚分隔线（FOOT_Y）之上
    const first = y + 56
    const maxLines = Math.max(1, Math.min(3, Math.floor((FOOT_Y - 40 - first) / 50) + 1))
    drawLines(ctx, wrap(ctx, ingredients.join('、'), contentW - 40, maxLines), cx, first, 50)
  }

  // 页脚：二维码 + 说明
  const footY = FOOT_Y
  doubleRule(ctx, 110, W - 110, footY)
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, url, { width: 170, margin: 1, color: { dark: C.ink, light: C.paper }, errorCorrectionLevel: 'M' })
  ctx.drawImage(qr, W - 110 - 170, footY + 28, 170, 170)
  ctx.textAlign = 'left'
  ctx.fillStyle = C.ink
  ctx.font = font(600, 36)
  ctx.fillText('扫码查看完整做法', 120, footY + 86)
  ctx.font = font(500, 26, SANS)
  ctx.fillStyle = C.wine
  ctx.fillText('蓝图 · 图文 · 烹饪模式', 120, footY + 136)
  ctx.fillStyle = C.muted
  ctx.font = font(400, 24, SANS)
  ctx.fillText(location.host, 120, footY + 178)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('生成图片失败'))), 'image/png'))
}
