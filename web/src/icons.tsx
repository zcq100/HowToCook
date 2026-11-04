export const GitHubIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
)

export const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
  </svg>
)

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const SunIcon = () => (
  <svg {...iconProps}>
    <circle cx="10" cy="10" r="3.5" />
    <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.3 4.3l1.1 1.1M14.6 14.6l1.1 1.1M4.3 15.7l1.1-1.1M14.6 5.4l1.1-1.1" />
  </svg>
)

export const MoonIcon = () => (
  <svg {...iconProps}>
    <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7z" />
  </svg>
)

/** 翻开的菜单：表示“典藏”纸质主题 */
export const PaperIcon = () => (
  <svg {...iconProps}>
    <path d="M10 5.5C8.3 4.2 5.8 3.8 3 4v11.5c2.8-.2 5.3.2 7 1.5 1.7-1.3 4.2-1.7 7-1.5V4c-2.8-.2-5.3.2-7 1.5z" />
    <path d="M10 5.5V17" />
  </svg>
)

/** 半明半暗的圆：表示“跟随系统” */
export const AutoThemeIcon = () => (
  <svg {...iconProps}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
  </svg>
)
