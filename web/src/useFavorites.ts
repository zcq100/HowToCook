import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'favorites'

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * 收藏的菜谱 id 列表（按收藏时间倒序），保存在 localStorage。
 * 同一浏览器的其他标签页修改后会通过 storage 事件同步过来。
 */
export function useFavorites() {
  const [ids, setIds] = useState<string[]>(read)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setIds(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* 隐私模式等：本次会话内仍然有效，只是不会保存 */
      }
      return next
    })
  }, [])

  return { ids, toggle }
}
