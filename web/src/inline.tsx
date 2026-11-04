import { Fragment, type ReactNode } from 'react'

/** 渲染菜谱中的少量行内 Markdown：![图片](url)、**加粗**、*强调*、`食材`、[链接](url) */
export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = []
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\([^)]*\)|`([^`]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[2]) out.push(<img key={m.index} className="inline-img" src={m[2]} alt={m[1]} loading="lazy" decoding="async" />)
    else if (m[3]) out.push(<strong key={m.index}>{m[3]}</strong>)
    else if (m[4]) out.push(<em key={m.index}>{m[4]}</em>)
    else if (m[6]) out.push(<strong key={m.index}>{m[6]}</strong>)
    else out.push(m[5])
    last = re.lastIndex
  }
  out.push(text.slice(last))
  return <>{out.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</>
}

export const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))
