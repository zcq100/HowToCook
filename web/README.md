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
- 图片在 Git LFS 中，未执行 `git lfs pull` 时会被跳过。
