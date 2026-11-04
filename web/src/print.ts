import type { Recipe } from './types'

/** 让页面里所有懒加载图片立刻加载，并等它们解码完成（最多等 8 秒） */
async function loadAllImages(root: ParentNode) {
  const imgs = [...root.querySelectorAll('img')]
  imgs.forEach((img) => (img.loading = 'eager'))
  const ready = Promise.all(imgs.map((img) => img.decode().catch(() => undefined)))
  await Promise.race([ready, new Promise((r) => setTimeout(r, 8000))])
}

/**
 * 打印当前图文配方。
 * 打印样式见 styles.css 中的 @media print：只保留 .text-view 这张菜单卡。
 */
export async function printRecipe(recipe: Recipe) {
  const article = document.querySelector('.text-view')
  if (article) await loadAllImages(article)

  // 浏览器“另存为 PDF”时用标题作为默认文件名
  const title = document.title
  document.title = `${recipe.name} · 菜谱`
  window.addEventListener('afterprint', () => (document.title = title), { once: true })
  window.print()
}

/** 用户直接按 Ctrl+P 时也尽量把懒加载图片加载出来（无法等待，尽力而为） */
export function eagerImagesOnPrint() {
  const onBefore = () => document.querySelectorAll<HTMLImageElement>('.text-view img').forEach((i) => (i.loading = 'eager'))
  window.addEventListener('beforeprint', onBefore)
  return () => window.removeEventListener('beforeprint', onBefore)
}
