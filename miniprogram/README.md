# HowToCook 原生微信小程序

原生 WXML / WXSS / TypeScript 验证版，独立于 Web 构建。当前包含 20 道内置文本菜谱、10 个分类、菜名与食材搜索、原料/步骤/提示详情，以及单菜谱分享路径。图片暂以占位区域呈现。

## 构建与打开

```bash
cd miniprogram
npm ci
npm run build
npm run verify
```

在微信开发者工具中导入 `miniprogram/` 目录（不是仓库根目录，也不是 `src/`），工具读取 `project.config.json`，以 `dist/` 为小程序根目录。TypeScript 已在本地编译，不需要开发者工具再编译 TS，也不需要“构建 npm”。修改源码后重新执行 `npm run build`。

已配置 AppID `wx5b929ed10b5ccafc`；真机预览、分享验证和上传需使用有相应权限的微信账号。个人工具设置放在已忽略的 `project.private.config.json`，不要提交密钥。

## 浏览器界面预览

执行 `npm run preview` 后打开 `http://127.0.0.1:8766`。本地适配器直接加载编译后的页面逻辑、WXML、WXSS 和样本数据，可查看分类、搜索和详情，不需要 AppID。浏览器预览不是微信运行环境，分享仅显示提示，原生组件和布局仍以开发者工具及真机为准。`preview/` 不会打包进小程序。

## 内容与包体

- `scripts/build-samples.mjs` 通过明确的 20 个 ID 从仓库 Markdown 重新生成 `src/data/samples.ts`。该生成文件提交到仓库，方便审阅样本变化。
- 复用 Web 的解析函数，导入解析模块不会执行 Web 构建或下载图片。样本生成不读取 Web 生成数据，也不需要 Git LFS 下载。
- 样本去除 Markdown 图片引用；不复制图片、Web 字体、Web 构建产物或原始菜谱目录。
- `dist/` 仅打包编译后的运行代码和明确类型的原生资源。`npm run verify` 检查数据查询、分页、无效 ID、图片排除和 1.5 MB 内部包体预算。实际上传体积以开发者工具包分析为准。
- `packages/recipe-core/types.ts` 是共享数据类型；`services/repository.ts` 定义列表、分类和详情接口，页面通过它访问本地样本。后续用 API 实现替换 repository 导出；正式 remote 构建还需排除本地样本依赖。

## 人工验收

1. 首次打开可见 20 道菜谱，切换任意分类可见对应两道样本。
2. 搜索“豆腐”或其他食材；搜索不存在的内容时显示空状态。
3. 打开菜谱，检查原料、长步骤、提示的滚动与文本选择。
4. 打开编译路径 `pages/recipe/index`，启动参数设置为 `id=soup%2F%E7%99%BD%E8%90%9D%E5%8D%9C%E4%B8%9D%E6%B8%85%E6%B1%A4`，确认可直接进入详情。
5. 将 ID 改为不存在的值，显示未收录提示，并可回到列表。
6. 使用真实 AppID，真机分享菜谱到聊天，再从分享入口进入指定详情。
7. 断网重启，确认分类、搜索和详情仍可用；查看包分析确认没有全量菜谱和照片。

当前尚未接入远程 API、图片、收藏或分步计时；它们属于后续里程碑。此环境已完成 TypeScript 和脚本校验，开发者工具 WXML 编译及 iOS/Android 真机验收仍需执行。

## 原生烹饪蓝图实验

在菜谱详情点击「展开烹饪蓝图」。节点由原生 view/text 渲染，连线使用 Canvas 2D，画布只占可视区域，避免长菜谱创建超高位图。先测量原生节点高度再布局；执行链从上到下，原料与工具在首次关联的步骤左侧出现。没有自动关联的原料在底部以虚线节点展示，仍需参考菜谱原文。

- 单指拖动画面，双指缩放；也可用底部加减按钮缩放。
- 点击步骤高亮相关原料及连线；上一步/下一步会将对应步骤移到可视区域。
- 「总览」恢复适合屏幕宽度的初始位置，「定位」回到当前步骤。
- 蓝图支持直接分享路径；当前不支持编辑节点或连线，不替代原文中未被自动识别的提示。
- 浏览器适配预览尚未模拟这套触摸与 Canvas 行为，请通过 `npm run wx:preview` 在微信里验证。重点检查长文本节点、连线对齐、双指缩放后定位、首末步骤按钮，以及有未关联原料的菜谱。

脚本校验覆盖所有样本的节点边界、互不重叠、连线端点、实测高度重新布局、缩放锚点和步骤高亮。iOS/Android 的触摸性能与实际布局仍需真机验收。

## 官方 CI 手机预览与上传

接入微信官方 `miniprogram-ci`，不依赖桌面开发者工具。小程序管理员需在微信公众平台「开发管理 → 开发设置 → 小程序代码上传」下载上传密钥，并将执行机器的公网出口 IP 配置到上传 IP 白名单。

默认密钥路径为 `miniprogram/.secrets/private.wx5b929ed10b5ccafc.key`，也可通过 `WECHAT_PRIVATE_KEY_PATH` 指定其他路径（相对路径以 `miniprogram/` 为基准）。密钥目录、`.key` / `.pem` 文件以及二维码产物均已忽略，不放入小程序包或 Git。此处需要代码上传密钥，不是 AppSecret。

```bash
cd miniprogram
npm run wx:check
npm run wx:preview
```

`wx:check` 只做本地检查，不连接微信。`wx:preview` 重新构建、校验，再向微信请求生成 `artifacts/preview.jpg`，使用有权限的手机微信扫码查看实际小程序。缺少密钥时会停止并说明路径；白名单或权限错误按微信返回的提示处理。

需要上传开发版本时单独执行：

```bash
WECHAT_VERSION=0.1.0 npm run wx:upload
```

上传后可在公众平台将开发版本设为体验版并管理体验成员；上传不等于提交审核或正式发布。浏览器预览仍使用 `npm run preview`，与手机微信预览是两个独立入口。

参考：[微信官方 miniprogram-ci](https://github.com/wechat-miniprogram/miniprogram-ci-dist)。
