import { useEffect, useRef, useState } from 'react'
import type { Recipe } from './types'
import { renderShareCard, shareUrl } from './shareCard'

/** 分享弹窗：预览分享卡片，可保存图片、调用系统分享、复制短链 */
export default function ShareDialog({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const url = shareUrl(recipe)
  const fileName = `${recipe.name}-菜谱蓝图.png`

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    renderShareCard(recipe)
      .then((b) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(b)
        setBlob(b)
        setPreview(objectUrl)
      })
      .catch((e) => !cancelled && setError(String(e?.message ?? e)))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [recipe])

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  const download = () => {
    if (!preview) return
    const a = document.createElement('a')
    a.href = preview
    a.download = fileName
    a.click()
  }
  const share = async () => {
    try {
      await navigator.share(
        canShareFile ? { files: [file!], title: recipe.name, text: `${recipe.name}的做法`, url } : { title: recipe.name, url },
      )
    } catch {
      /* 用户取消 */
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // 不支持 clipboard API 时退回到选中文本
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="share-overlay" onClick={onClose} role="presentation">
      <div className="share-dialog" role="dialog" aria-modal="true" aria-label={`分享 ${recipe.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="share-head">
          <h2>分享这道菜</h2>
          <button ref={closeRef} className="share-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="share-preview">
          {preview ? (
            <img src={preview} alt={`${recipe.name} 分享卡片`} />
          ) : (
            <div className="share-loading">{error ? `生成失败：${error}` : '正在生成卡片…'}</div>
          )}
        </div>
        <p className="share-hint">手机上也可以长按图片保存</p>
        <div className="share-actions">
          <button className="share-primary" onClick={download} disabled={!preview}>
            保存图片
          </button>
          {'share' in navigator && (
            <button onClick={share} disabled={!blob}>
              分享…
            </button>
          )}
          <button onClick={copy}>{copied ? '已复制链接' : '复制链接'}</button>
        </div>
        <div className="share-link" title={url}>
          {decodeURI(url)}
        </div>
      </div>
    </div>
  )
}
