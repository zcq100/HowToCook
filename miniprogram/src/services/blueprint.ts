import type { Recipe } from '../../../packages/recipe-core/types'

export interface GraphNode {
  id: string; kind: 'start' | 'step' | 'ingredient' | 'result'
  x: number; y: number; width: number; height: number
  title: string; text: string; notes: string[]; meta: string
  wireColor: string; inputPorts: { id: string; color: string }[]
  tone: 'start' | 'step' | 'ingredient' | 'tool' | 'result'; stepIndex: number; uses: string[]; unlinked: boolean; active: boolean
}
export interface GraphEdge { source: string; target: string; kind: 'flow' | 'ingredient'; stepIndex: number; inputIndex?: number }
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[]; width: number; height: number }
export interface Camera { x: number; y: number; scale: number }
/** Same hue assignment as H5 paper: ingredients 50%/38%, tools 205/70%/38%. */
function ingredientColor(index: number, tool: boolean): string {
  const hue = tool ? 205 : (95 + index * 137.5) % 360
  const saturation = tool ? .7 : .5, lightness = .38
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1)), m = lightness - chroma / 2
  const rgb = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x]
  return '#' + rgb.map(value => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join('')
}
export function constrainCamera(camera: Camera, graph: Pick<Graph, 'width' | 'height'>, viewport: { width: number; height: number }): Camera {
  const scale = Math.max(.45, Math.min(1.6, camera.scale))
  const width = graph.width * scale, height = graph.height * scale, margin = 24
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
  const centerX = (viewport.width - width) / 2
  return { scale,
    x: width <= viewport.width - margin * 2 ? clamp(camera.x, centerX - margin, centerX + margin) : clamp(camera.x, viewport.width - width - margin, margin),
    y: height <= viewport.height - margin * 2 ? clamp(camera.y, 0, margin) : clamp(camera.y, viewport.height - height - margin, margin),
  }
}
export const INGREDIENT_OUTPUT_Y = 32
export const STEP_INPUT_Y = 60
export const STEP_INPUT_GAP = 18

export function connectionPoints(edge: GraphEdge, source: GraphNode, target: GraphNode) {
  return edge.kind === 'flow'
    ? { x: source.x + source.width / 2, y: source.y + source.height, tx: target.x + target.width / 2, ty: target.y }
    : { x: source.x + source.width, y: source.y + INGREDIENT_OUTPUT_Y, tx: target.x, ty: target.y + STEP_INPUT_Y + (edge.inputIndex || 0) * STEP_INPUT_GAP }
}

/** Platform-independent layout. Measured native node heights replace estimates. */
export function buildBlueprint(recipe: Recipe, heights: Record<string, number> = {}): Graph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const firstUse = new Map<string, number>()
  const ingredients = new Set(recipe.ingredients.map(i => i.id))
  const food = recipe.ingredients.filter(item => item.kind === 'ingredient')
  const colors = new Map(recipe.ingredients.map(item => [item.id, ingredientColor(food.indexOf(item), item.kind === 'tool')]))
  recipe.steps.forEach((step, index) => step.uses.forEach(id => { if (ingredients.has(id) && !firstUse.has(id)) firstUse.set(id, index) }))
  const node = (id: string, kind: GraphNode['kind'], title: string, text: string, x: number, y: number, width: number, fallback: number, stepIndex = -1): GraphNode =>
    ({ id, kind, tone: kind, title, text, x, y, width, height: heights[id] || fallback, notes: [], meta: '', wireColor: '', inputPorts: [], stepIndex, uses: [], unlinked: false, active: false })
  nodes.push(node('start', 'start', '开始烹饪', recipe.servingsNote || '按原料清单备好食材与工具', 280, 24, 280, 112))
  let y = nodes[0].y + nodes[0].height + 64
  let previous = 'start'
  const addIngredient = (ingredient: Recipe['ingredients'][number], top: number, unlinked = false) => {
    const text = ingredient.amounts.join('；') || '按实际需要准备'
    const item = node(ingredient.id, 'ingredient', ingredient.name, text, 24, top, 180, 80 + Math.ceil(text.length / 10) * 20)
    item.meta = ingredient.kind === 'tool' ? '工具' : '食材'
    item.tone = ingredient.kind
    item.wireColor = colors.get(ingredient.id)!
    item.unlinked = unlinked
    nodes.push(item)
    return item.height + 18
  }
  recipe.steps.forEach((step, index) => {
    const item = node(step.id, 'step', `第 ${index + 1} 步`, step.text, 280, y, 280, 108 + Math.ceil(step.text.length / 15) * 24 + step.notes.join('').length * 2, index)
    item.notes = step.notes
    item.meta = [step.heat, ...step.times].filter(Boolean).join(' · ')
    item.uses = step.uses.filter(id => ingredients.has(id))
    item.inputPorts = item.uses.map(id => ({ id, color: colors.get(id)! }))
    if (!heights[step.id]) item.height = Math.max(item.height, 68 + item.uses.length * STEP_INPUT_GAP)
    nodes.push(item)
    edges.push({ source: previous, target: step.id, kind: 'flow', stepIndex: index })
    item.uses.forEach((id, inputIndex) => edges.push({ source: id, target: step.id, kind: 'ingredient', stepIndex: index, inputIndex }))
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
