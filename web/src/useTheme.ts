import { useCallback, useEffect, useState } from 'react'

export type Theme = 'paper' | 'light' | 'dark'

export const THEME_ORDER: Theme[] = ['paper', 'light', 'dark']
export const THEME_LABEL: Record<Theme, string> = { paper: '典藏', light: '浅色', dark: '深色' }
/** 未选择过主题（或保存的值已失效，如旧版的“跟随系统”）时使用 */
export const DEFAULT_THEME: Theme = 'paper'

const STORAGE_KEY = 'theme'
const META_COLORS: Record<Theme, string> = { dark: '#1e1e1e', light: '#ffffff', paper: '#f6efe0' }

// 隐私模式等场景下 localStorage 可能不可用，此时只是不记住选择
function readTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return THEME_ORDER.includes(v as Theme) ? (v as Theme) : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/** 主题：默认“典藏”，用户选择后保存在 localStorage */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme])
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* 忽略 */
    }
    setThemeState(t)
  }, [])

  return { theme, setTheme }
}

/** React Flow 只区分明暗 */
export const flowColorMode = (t: Theme) => (t === 'dark' ? 'dark' : 'light')
