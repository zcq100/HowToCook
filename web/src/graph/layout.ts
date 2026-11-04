import type { Edge, Node } from '@xyflow/react'
import type { Recipe } from '../types'

export const STEP_W = 300
export const ING_W = 190
const COL_GAP = 70
const ING_GAP = 14

/**
 * 每个原料一个色相，方便追踪长连线（工具统一用蓝色）。
 * 饱和度 / 亮度取 CSS 变量 --pin-s / --pin-l，由各主题决定。
 */
export function ingredientColor(recipe: Recipe, id: string) {
  const ing = recipe.ingredients.find((i) => i.id === id)
  if (!ing) return 'hsl(210 8% var(--pin-l))'
  if (ing.kind === 'tool') return 'hsl(205 calc(var(--pin-s) + 20%) var(--pin-l))'
  const idx = recipe.ingredients.filter((i) => i.kind === 'ingredient').indexOf(ing)
  const hue = (95 + idx * 137.5) % 360
  return `hsl(${hue.toFixed(1)} var(--pin-s) var(--pin-l))`
}

/** 布局方向：横向（步骤从左到右）/ 竖向（步骤从上到下） */
export type Direction = 'LR' | 'TB'

export type Sizes = Map<string, { w: number; h: number }>

const EVENT_W = 260
const ROW_GAP = 60

// 首次渲染还没有实测尺寸时用的估算值；渲染完成后会用实测尺寸重新布局
// 原料节点里的用量最多显示 3 行（见 styles.css 的 line-clamp）
const AMOUNT_CHARS_PER_LINE = 13
const estimateIngHeight = (amounts: string[]) =>
  44 + amounts.reduce((h, a) => h + Math.min(3, Math.ceil(a.length / AMOUNT_CHARS_PER_LINE)) * 18, 0)
const estimateStepHeight = (step: Recipe['steps'][number]) =>
  90 + step.uses.length * 24 + Math.ceil(step.text.length / 17) * 21 + step.notes.length * 44 +
  (/!\[/.test(step.text + step.notes.join('')) ? 190 : 0)
const estimateEventHeight = (recipe: Recipe) =>
  120 + (recipe.servingsNote ? Math.ceil(recipe.servingsNote.length / 19) : 0) * 19

/**
 * “执行链”布局：开始 → 步骤1 → 步骤2 … → 成品。
 * - LR：步骤排成一行；每个原料放在它第一次被使用的步骤左侧的一列中。
 * - TB：步骤排成一列；原料放在步骤左侧的一列中，与第一次使用它的步骤顶部对齐。
 * 未被任何步骤引用的原料和工具放在开始节点下方（LR）或左侧（TB）。
 * sizes 为实测的节点尺寸（可选），没有时使用估算值。
 */
export function buildGraph(recipe: Recipe, dir: Direction = 'LR', sizes?: Sizes): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const firstUse = new Map<string, number>()
  recipe.steps.forEach((s, k) => s.uses.forEach((id) => firstUse.has(id) || firstUse.set(id, k)))
  const unlinked = recipe.ingredients.filter((i) => !firstUse.has(i.id))

  const h = (id: string, fallback: number) => sizes?.get(id)?.h ?? fallback
  const ingH = (ing: Recipe['ingredients'][number]) => h(ing.id, estimateIngHeight(ing.amounts))
  const ingNode = (ing: Recipe['ingredients'][number], x: number, y: number, unlinked = false): Node => ({
    id: ing.id,
    type: 'ingredient',
    position: { x, y },
    data: { ingredient: ing, color: ingredientColor(recipe, ing.id), ...(unlinked && { unlinked: true }) },
  })
  const stepNode = (step: Recipe['steps'][number], x: number, y: number): Node => ({
    id: step.id,
    type: 'step',
    position: { x, y },
    data: { step, recipe, total: recipe.steps.length },
    style: { width: STEP_W },
  })
  const eventH = h('start', estimateEventHeight(recipe))

  if (dir === 'LR') {
    nodes.push({ id: 'start', type: 'event', position: { x: 0, y: 0 }, data: { recipe } })
    let y = eventH + 24
    for (const ing of unlinked) {
      nodes.push(ingNode(ing, 0, y, true))
      y += ingH(ing) + ING_GAP
    }
    let cursor = EVENT_W + COL_GAP
    recipe.steps.forEach((step, k) => {
      const feeds = recipe.ingredients.filter((i) => firstUse.get(i.id) === k)
      if (feeds.length) {
        let fy = 120
        for (const ing of feeds) {
          nodes.push(ingNode(ing, cursor, fy))
          fy += ingH(ing) + ING_GAP
        }
        cursor += ING_W + COL_GAP
      }
      nodes.push(stepNode(step, cursor, 0))
      cursor += STEP_W + COL_GAP
    })
    nodes.push({ id: 'result', type: 'result', position: { x: cursor, y: 0 }, data: { recipe } })
  } else {
    // 竖向：步骤列在 x=0，原料列在其左侧
    const ingX = -(ING_W + COL_GAP)
    const centerX = (STEP_W - EVENT_W) / 2
    nodes.push({ id: 'start', type: 'event', position: { x: centerX, y: 0 }, data: { recipe } })
    let ingCursor = 0
    for (const ing of unlinked) {
      nodes.push(ingNode(ing, ingX, ingCursor, true))
      ingCursor += ingH(ing) + ING_GAP
    }
    let cursor = eventH + ROW_GAP
    recipe.steps.forEach((step, k) => {
      const stepY = cursor
      nodes.push(stepNode(step, 0, stepY))
      let fy = Math.max(stepY, ingCursor)
      for (const ing of recipe.ingredients.filter((i) => firstUse.get(i.id) === k)) {
        nodes.push(ingNode(ing, ingX, fy))
        fy += ingH(ing) + ING_GAP
      }
      ingCursor = fy
      cursor = stepY + h(step.id, estimateStepHeight(step)) + ROW_GAP
    })
    nodes.push({ id: 'result', type: 'result', position: { x: centerX, y: cursor }, data: { recipe } })
  }

  // 连线与方向无关；执行引脚在 LR 下位于左右两侧，在 TB 下位于上下两端（见 nodes.tsx）
  recipe.steps.forEach((step, k) => {
    edges.push({
      id: `exec-${k}`,
      source: k === 0 ? 'start' : recipe.steps[k - 1].id,
      sourceHandle: 'exec-out',
      target: step.id,
      targetHandle: 'exec-in',
      data: { kind: 'exec', order: k },
    })
    for (const id of step.uses) {
      edges.push({
        id: `${id}->${step.id}`,
        source: id,
        sourceHandle: 'out',
        target: step.id,
        targetHandle: `in-${id}`,
        data: { kind: 'data', color: ingredientColor(recipe, id) },
      })
    }
  })
  edges.push({
    id: 'exec-end',
    source: recipe.steps.at(-1)?.id ?? 'start',
    sourceHandle: 'exec-out',
    target: 'result',
    targetHandle: 'exec-in',
    data: { kind: 'exec', order: recipe.steps.length },
  })
  return { nodes, edges }
}
