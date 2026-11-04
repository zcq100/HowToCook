# HowToCook Web 阅览器（原型）

把 `../dishes` 里的 Markdown 菜谱解析成结构化数据，并提供多种阅览方式。

## 运行

```bash
cd web
npm install
npm run dev     # 先解析菜谱生成 public/data/recipes.json，再启动 Vite
npm run build   # 产物在 dist/
```

## 阅览方式

- **蓝图**：仿 UE 蓝图的节点连线图。红色事件节点 → 蓝色步骤节点由白色执行线串起；原料 / 工具是带彩色引脚的纯函数节点，连到用到它的每一个步骤。支持 ← → 逐步执行、悬停高亮关联连线。
- **图文**：传统的菜谱阅读视图。

新增视图：在 `src/views/` 写一个接收 `{ recipe }` 的组件，并注册到 `src/App.tsx` 的 `VIEWS`。

## 数据解析

`scripts/build-data.mjs` 依赖菜谱模板的四个固定章节（必备原料和工具 / 计算 / 操作 / 附加内容）：

- 原料与步骤之间的连线靠名称匹配（含别名、同义词），约 88% 的原料能自动关联；识别不到的原料以虚线框放在开始节点下方。
- 火候（大火 / 小火…）和时长（10 分钟…）从步骤文本中提取。
- 图片：解析所有章节里的图片引用（成品图、步骤图、附加内容图），复制到 `public/images/`。仓库中的图片是 Git LFS 文件，若检出的只是 LFS 指针（本地未装 git-lfs、或 Cloudflare 构建环境），会从 `media.githubusercontent.com` 下载真实文件并校验 sha256，缓存在 `web/.cache/lfs/`。下载失败的图片会被跳过，不会中断构建。
  - 仓库 / 分支可用环境变量 `LFS_MEDIA_BASE` 覆盖，默认 `https://media.githubusercontent.com/media/zcq100/HowToCook/zcq100`。
  - 完整下载约 107 MB，计入 GitHub 账号的 LFS 带宽额度。

## 分享与链接预览

- 每道菜的分享短链是 `/r/<菜谱 id>`（例如 `/r/meat_dish/可乐鸡翅`）。打开后前端会改写成 `/#text/<菜谱 id>`，进入图文视图。
- 站内路由用 `#`，链接预览抓取器看不到 `#` 之后的内容，所以 `worker/index.js` 只处理 `/` 和 `/r/*`：用 HTMLRewriter 把 `index.html` 里的标题、简介和 `og:image` 换成该菜谱的内容，并改成绝对地址。其余请求直接走静态资源（见 `wrangler.jsonc` 的 `run_worker_first`）。
- 顶栏“分享”会在浏览器里生成一张 1080×1440 的典藏风格分享卡片（`src/shareCard.ts`），带成品图和指向短链的二维码，可保存、系统分享或复制链接。
- 图标和默认预览图的源文件在 `brand/`（`icon.svg`、`og.html`），`public/` 里是渲染好的 PNG。改了源文件后需要重新渲染。
- 微信内置浏览器不读取 Open Graph 标签，自定义分享标题和配图需要接入公众号的 JS-SDK。这里只保证页面标题正确，推荐在微信里分享卡片图片。

## 容器镜像

打 `w` 前缀的 tag 时，`.github/workflows/container-web.yml` 会构建镜像并推送到 `ghcr.io/zcq100/howtocook-web`（标签：版本号、原 tag、`latest`；amd64 + arm64）。

```bash
docker run --rm -p 8080:8080 ghcr.io/zcq100/howtocook-web:latest   # http://localhost:8080

# 本地构建（在仓库根目录执行）
docker build -f web/Dockerfile -t howtocook-web .
```

- 镜像 = [static-web-server](https://static-web-server.net)（scratch 基础，约 8MB）+ 构建好的静态站点，约 127MB，其中绝大部分是菜谱照片。
- 以非 root 用户（UID 65534）监听 8080；`/health` 为健康检查；配置见 `web/container/sws.toml`。
- 容器里没有 Cloudflare Worker，所以每道菜的链接预览（`/r/<菜谱>` 的 meta 改写）不可用，但短链本身可以正常打开。
