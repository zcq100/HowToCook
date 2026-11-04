import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const query = '(prefers-color-scheme: light)'
const META_COLORS: Record<Theme, string> = { dark: '#1e1e1e', light: '#ffffff' }

// 隐私模式等场景下 localStorage 可能不可用，此时只是不记住选择
function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const systemTheme = (): Theme => (window.matchMedia(query).matches ? 'light' : 'dark')

/** 主题偏好：默认跟随系统，用户手动选择后保存在 localStorage */
export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(readPref)
  const system = useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    systemTheme,
  )
  const theme: Theme = pref === 'system' ? system : pref

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme])
  }, [theme])

  const setPref = useCallback((p: ThemePref) => {
    try {
      if (p === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, p)
    } catch {
      /* 忽略 */
    }
    setPrefState(p)
  }, [])

  return { pref, theme, setPref }
}

export const THEME_ORDER: ThemePref[] = ['system', 'light', 'dark']
export const THEME_LABEL: Record<ThemePref, string> = { system: '跟随系统', light: '浅色', dark: '深色' }
