/**
 * 用量行通常以原料名开头（“可乐 500ml”），在原料表里重复显示名称没有意义。
 * 若开头的词与原料名互相包含（“鸡翅 10 只” / 原料“鸡翅中”），就去掉它。
 */
export function trimName(name: string, amount: string) {
  const m = amount.match(/^([^\s:：\d]+)[\s:：]+(.+)$/)
  if (!m) return amount
  const base = name.replace(/[（(][^）)]*[）)]/g, '')
  return base.includes(m[1]) || m[1].includes(base) ? m[2] : amount
}

/** 去掉行内 Markdown 标记（含图片），用于朗读等纯文本场景 */
export function plainText(md: string) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const UNIT_SECONDS: Record<string, number> = { 小时: 3600, h: 3600, 分钟: 60, 分: 60, min: 60, 秒: 1, s: 1 }

/**
 * 解析步骤里提取出的时长，如 “10分钟”“5-7分钟”“30S”“1~2小时”。
 * 区间取下限作为倒计时（到点先检查状态），label 保留原始区间。
 */
export function parseDuration(text: string): { seconds: number; label: string } | null {
  const m = text.match(/^(\d+(?:\.\d+)?)(?:[-～~至到](\d+(?:\.\d+)?))?(小时|分钟|分|秒|min|h|s)$/i)
  if (!m) return null
  const unit = UNIT_SECONDS[m[3].toLowerCase()] ?? UNIT_SECONDS[m[3]]
  const seconds = Math.round(parseFloat(m[1]) * unit)
  if (!seconds) return null
  const unitLabel = /^(s|秒)$/i.test(m[3]) ? '秒' : /^(h|小时)$/i.test(m[3]) ? '小时' : '分钟'
  return { seconds, label: m[2] ? `${m[1]}–${m[2]} ${unitLabel}` : `${m[1]} ${unitLabel}` }
}

/** 秒数格式化为 mm:ss 或 h:mm:ss */
export function formatClock(total: number) {
  const s = Math.max(0, Math.ceil(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
