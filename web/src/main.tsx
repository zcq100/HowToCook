import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
// 典藏主题的中文衬线字体。iOS / Android 没有内置中文宋体，需要随站点提供；
// 字体按字符范围拆成小文件，只有页面真正用到时才会下载（浅色 / 深色主题不会触发下载）
import '@fontsource-variable/noto-serif-sc'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
