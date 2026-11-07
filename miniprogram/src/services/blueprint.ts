import type { Recipe } from '../../../packages/recipe-core/types'

export interface GraphNode {
  id: string; kind: 'start' | 'step' | 'ingredient' | 'result'
  x: number; y: number; width: number; height: number
  title: string; text: string; notes: string[]; meta: string
  stepIndex: number; uses: string[]; unlinked: boolean; active: boolean
}
export interface GraphEdge { source: string; target: string; kind: 'flow' | 'ingredient'; stepIndex: number }
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[]; width: number; height: number }
export interface Camera { x: number; y: number; scale: number }

/** Platform-independent layout. Measured native node heights replace estimates. */
export function buildBlueprint(recipe: Recipe, heights: Record<string, number> = {}): Graph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const firstUse = new Map<string, number>()
  const ingredients = new Set(recipe.ingredients.map(i => i.id))
  recipe.steps.forEach((step, index) => step.uses.forEach(id => { if (ingredients.has(id) && !firstUse.has(id)) firstUse.set(id, index) }))
  const node = (id: string, kind: GraphNode['kind'], title: string, text: string, x: number, y: number, width: number, fallback: number, stepIndex = -1): GraphNode =>
    ({ id, kind, title, text, x, y, width, height: heights[id] || fallback, notes: [], meta: '', stepIndex, uses: [], unlinked: false, active: false })
  nodes.push(node('start', 'start', '开始烹饪', recipe.servingsNote || '按原料清单备好食材与工具', 280, 24, 280, 112))
  let y = nodes[0].y + nodes[0].height + 64
  let previous = 'start'
  const addIngredient = (ingredient: Recipe['ingredients'][number], top: number, unlinked = false) => {
    const text = ingredient.amounts.join('；') || '按实际需要准备'
    const item = node(ingredient.id, 'ingredient', ingredient.name, text, 24, top, 180, 80 + Math.ceil(text.length / 10) * 20)
    item.meta = ingredient.kind === 'tool' ? '工具' : '食材'
    item.unlinked = unlinked
    nodes.push(item)
    return item.height + 18
  }
  recipe.steps.forEach((step, index) => {
    const item = node(step.id, 'step', `第 ${index + 1} 步`, step.text, 280, y, 280, 108 + Math.ceil(step.text.length / 15) * 24 + step.notes.join('').length * 2, index)
    item.notes = step.notes
    item.meta = [step.heat, ...step.times].filter(Boolean).join(' · ')
    item.uses = step.uses.filter(id => ingredients.has(id))
    nodes.push(item)
    edges.push({ source: previous, target: step.id, kind: 'flow', stepIndex: index })
    for (const id of item.uses) edges.push({ source: id, target: step.id, kind: 'ingredient', stepIndex: index })
    let bottom = y
    for (const ingredient of recipe.ingredients.filter(i => firstUse.get(i.id) === index)) bottom += addIngredient(ingredient, bottom)
    y = Math.max(y + item.height, bottom) + 64
    previous = step.id
  })
  const result = node('result', 'result', '可以开饭了', recipe.name, 280, y, 280, 104)
  nodes.push(result)
  edges.push({ source: previous, target: 'result', kind: 'flow', stepIndex: recipe.steps.length })
  let unlinkedY = y + result.height + 64
  for (const ingredient of recipe.ingredients.filter(i => !firstUse.has(i.id))) unlinkedY += addIngredient(ingredient, unlinkedY, true)
  return { nodes, edges, width: 584, height: Math.max(y + result.height, unlinkedY) + 24 }
}

export function zoomAt(camera: Camera, scale: number, x: number, y: number): Camera {
  const next = Math.max(.45, Math.min(1.6, scale))
  const ratio = next / camera.scale
  return { scale: next, x: x - (x - camera.x) * ratio, y: y - (y - camera.y) * ratio }
}
