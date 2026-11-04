import type { Edge, Node } from '@xyflow/react'
import type { Recipe } from '../types'

export const STEP_W = 300
export const ING_W = 190
const COL_GAP = 70
const ING_GAP = 14

/** 每个原料一个色相，方便追踪长连线（工具统一用蓝色） */
export function ingredientColor(recipe: Recipe, id: string) {
  const ing = recipe.ingredients.find((i) => i.id === id)
  if (!ing) return '#9aa0a6'
  if (ing.kind === 'tool') return '#4fb3ff'
  const idx = recipe.ingredients.filter((i) => i.kind === 'ingredient').indexOf(ing)
  const hue = (95 + idx * 137.5) % 360
  return `hsl(${hue} 70% 62%)`
}

// 原料节点里的用量最多显示 3 行（见 nodes.tsx 的 line-clamp），按此估算高度
const AMOUNT_CHARS_PER_LINE = 13
const estimateIngHeight = (amounts: string[]) =>
  44 + amounts.reduce((h, a) => h + Math.min(3, Math.ceil(a.length / AMOUNT_CHARS_PER_LINE)) * 18, 0)

/**
 * 横向“执行链”布局：开始 → 步骤1 → 步骤2 … → 成品。
 * 每个原料放在它第一次被使用的步骤左侧的一列中；未被任何步骤引用的原料和工具放在开始节点下方。
 */
export function buildGraph(recipe: Recipe): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const firstUse = new Map<string, number>()
  recipe.steps.forEach((s, k) => s.uses.forEach((id) => firstUse.has(id) || firstUse.set(id, k)))

  const unlinked = recipe.ingredients.filter((i) => !firstUse.has(i.id))
  nodes.push({ id: 'start', type: 'event', position: { x: 0, y: 0 }, data: { recipe } })
  let y = 150
  for (const ing of unlinked) {
    nodes.push({
      id: ing.id,
      type: 'ingredient',
      position: { x: 0, y },
      data: { ingredient: ing, color: ingredientColor(recipe, ing.id), unlinked: true },
    })
    y += estimateIngHeight(ing.amounts) + ING_GAP
  }

  let cursor = 260 + COL_GAP
  recipe.steps.forEach((step, k) => {
    const feeds = recipe.ingredients.filter((i) => firstUse.get(i.id) === k)
    if (feeds.length) {
      let fy = 120
      for (const ing of feeds) {
        nodes.push({
          id: ing.id,
          type: 'ingredient',
          position: { x: cursor, y: fy },
          data: { ingredient: ing, color: ingredientColor(recipe, ing.id) },
        })
        fy += estimateIngHeight(ing.amounts) + ING_GAP
      }
      cursor += ING_W + COL_GAP
    }
    nodes.push({
      id: step.id,
      type: 'step',
      position: { x: cursor, y: 0 },
      data: { step, recipe, total: recipe.steps.length },
      style: { width: STEP_W },
    })
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
    cursor += STEP_W + COL_GAP
  })

  nodes.push({ id: 'result', type: 'result', position: { x: cursor, y: 0 }, data: { recipe } })
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
