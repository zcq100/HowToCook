import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 站点部署在域名根路径；分享短链 /r/<菜谱> 也会返回 index.html，资源必须用绝对路径
  base: '/',
  plugins: [react()],
})
