import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
// 典藏主题的中文衬线字体。iOS / Android 没有内置中文宋体，需要随站点提供；
// 字体按字符范围拆成小文件，只有页面真正用到时才会下载（浅色 / 深色主题不会触发下载）
import '@fontsource-variable/noto-serif-sc'
import './styles.css'
import App from './App'

// 分享短链 /r/<菜谱 id> → 站内路由 /#text/<菜谱 id>（在首次渲染前改写，避免相对路径的图片按 /r/ 解析）
const share = location.pathname.match(/^\/r\/(.+)$/)
if (share) history.replaceState(null, '', `/#text/${share[1]}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
