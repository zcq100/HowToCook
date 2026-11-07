import { repository } from '../../services/repository'
import { buildBlueprint, zoomAt } from '../../services/blueprint'
import type { Camera, Graph, GraphNode } from '../../services/blueprint'
import type { Recipe } from '../../../../packages/recipe-core/types'

type CanvasInfo = { node: WechatMiniprogram.Canvas; width: number; height: number; left: number; top: number }
type Touch = { clientX: number; clientY: number }
const center = (touches: Touch[]) => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 })
const distance = (touches: Touch[]) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

Page({
  data: { nodes: [] as GraphNode[], name: '', error: '', loading: true, activeIndex: -1, total: 0, currentLabel: '选择步骤查看关联', x: 0, y: 0, scale: 1, zoomLabel: '100%', width: 584, height: 0 },
  recipe: null as Recipe | null,
  graph: null as Graph | null,
  canvas: null as WechatMiniprogram.Canvas | null,
  context: null as WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D | null,
  viewport: { width: 0, height: 0, left: 0, top: 0 },
  gesture: null as { touches: Touch[]; camera: Camera } | null,
  drawTimer: null as ReturnType<typeof setTimeout> | null,
  disposed: false,
  ready: false,
  async onLoad(options: Record<string, string | undefined>) {
    try {
      this.recipe = await repository.getRecipe(decodeURIComponent(options.id || ''))
      if (this.disposed) return
      this.graph = buildBlueprint(this.recipe)
      this.setData({ name: this.recipe.name, total: this.recipe.steps.length, nodes: this.graph.nodes, height: this.graph.height, loading: false })
      if (this.ready) this.initialize()
    } catch (error) { this.setData({ loading: false, error: error instanceof Error ? error.message : '蓝图加载失败' }) }
  },
  onReady() { this.ready = true; if (this.graph) this.initialize() },
  initialize() {
    wx.nextTick(() => {
      if (this.disposed) return
      this.createSelectorQuery().select('#connections').fields({ node: true, size: true, rect: true }).exec(results => {
        const info = results[0] as CanvasInfo | null
        if (!info?.node) { this.setData({ error: '画布初始化失败，请返回后重试' }); return }
        this.viewport = { width: info.width, height: info.height, left: info.left, top: info.top }
        this.canvas = info.node
        const ratio = wx.getWindowInfo().pixelRatio
        info.node.width = Math.round(info.width * ratio)
        info.node.height = Math.round(info.height * ratio)
        this.context = info.node.getContext('2d')
        this.context.setTransform(ratio, 0, 0, ratio, 0, 0)
        this.measureNodes()
      })
    })
  },
  measureNodes() {
    this.createSelectorQuery().selectAll('.graph-node').boundingClientRect().exec(allResults => {
      const results = allResults[0]
      if (!this.recipe || this.disposed) return
      const heights: Record<string, number> = {}
      for (const result of results as WechatMiniprogram.BoundingClientRectCallbackResult[]) {
        if (result.dataset?.id) heights[result.dataset.id] = result.height / this.data.scale
      }
      this.graph = buildBlueprint(this.recipe, heights)
      this.setData({ nodes: this.graph.nodes, height: this.graph.height }, () => this.resetView())
    })
  },
  camera(): Camera { return { x: this.data.x, y: this.data.y, scale: this.data.scale } },
  moveCamera(camera: Camera) {
    if (!this.graph) return
    const x = Math.max(-this.graph.width * camera.scale + 60, Math.min(this.viewport.width - 60, camera.x))
    const y = Math.max(-this.graph.height * camera.scale + 60, Math.min(this.viewport.height - 60, camera.y))
    this.setData({ x, y, scale: camera.scale, zoomLabel: `${Math.round(camera.scale * 100)}%` })
    this.scheduleDraw()
  },
  resetView() {
    const scale = Math.min(1, Math.max(.45, (this.viewport.width - 24) / 584))
    this.moveCamera({ x: (this.viewport.width - 584 * scale) / 2, y: 16, scale })
  },
  onTouchStart(event: WechatMiniprogram.TouchEvent) { this.gesture = { touches: event.touches.map(t => ({ clientX: t.clientX, clientY: t.clientY })), camera: this.camera() } },
  onTouchMove(event: WechatMiniprogram.TouchEvent) {
    const gesture = this.gesture
    if (!gesture) return
    const touches = event.touches
    if (touches.length !== gesture.touches.length) { this.onTouchStart(event); return }
    if (touches.length >= 2) {
      const start = center(gesture.touches), now = center(touches)
      const next = zoomAt(gesture.camera, gesture.camera.scale * distance(touches) / Math.max(1, distance(gesture.touches)), start.x - this.viewport.left, start.y - this.viewport.top)
      this.moveCamera({ ...next, x: next.x + now.x - start.x, y: next.y + now.y - start.y })
    } else if (touches.length === 1) this.moveCamera({ ...gesture.camera, x: gesture.camera.x + touches[0].clientX - gesture.touches[0].clientX, y: gesture.camera.y + touches[0].clientY - gesture.touches[0].clientY })
  },
  onTouchEnd(event: WechatMiniprogram.TouchEvent) { if (event.touches.length) this.onTouchStart(event); else this.gesture = null },
  zoomIn() { this.zoom(1.2) },
  zoomOut() { this.zoom(1 / 1.2) },
  zoom(factor: number) { this.moveCamera(zoomAt(this.camera(), this.data.scale * factor, this.viewport.width / 2, this.viewport.height / 2)) },
  selectNode(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index)
    if (index >= 0) this.selectStep(index, false)
  },
  previousStep() { this.selectStep(Math.max(0, this.data.activeIndex - 1), true) },
  nextStep() { this.selectStep(Math.min(this.data.total - 1, this.data.activeIndex + 1), true) },
  locateStep() { this.selectStep(Math.max(0, this.data.activeIndex), true) },
  selectStep(index: number, locate: boolean) {
    if (!this.graph || !this.recipe?.steps[index]) return
    const step = this.recipe.steps[index]
    const used = new Set(step.uses)
    this.setData({ activeIndex: index, currentLabel: `第 ${index + 1} / ${this.data.total} 步`, nodes: this.graph.nodes.map((node: GraphNode) => ({ ...node, active: node.id === step.id || used.has(node.id) })) })
    if (locate) {
      const node = this.graph.nodes.find((n: GraphNode) => n.id === step.id)!
      const scale = Math.max(.8, this.data.scale)
      this.moveCamera({ scale, x: this.viewport.width / 2 - (node.x + node.width / 2) * scale, y: 24 - node.y * scale })
    } else this.scheduleDraw()
  },
  scheduleDraw() { if (!this.drawTimer) this.drawTimer = setTimeout(() => { this.drawTimer = null; this.drawConnections() }, 16) },
  drawConnections() {
    const ctx = this.context
    if (!ctx || !this.graph || this.disposed) return
    ctx.clearRect(0, 0, this.viewport.width, this.viewport.height)
    ctx.save()
    ctx.translate(this.data.x, this.data.y)
    ctx.scale(this.data.scale, this.data.scale)
    const nodes = new Map<string, GraphNode>(this.graph.nodes.map((node: GraphNode) => [node.id, node]))
    for (const edge of this.graph.edges) {
      const source = nodes.get(edge.source), target = nodes.get(edge.target)
      if (!source || !target) continue
      const active = edge.stepIndex === this.data.activeIndex
      ctx.globalAlpha = this.data.activeIndex < 0 || active ? 1 : .2
      ctx.strokeStyle = edge.kind === 'flow' ? '#dce6df' : '#b9cb78'
      ctx.lineWidth = active ? 3 : 1.5
      ctx.beginPath()
      if (edge.kind === 'flow') {
        const x = source.x + source.width / 2, y = source.y + source.height
        const tx = target.x + target.width / 2, ty = target.y
        ctx.moveTo(x, y); ctx.bezierCurveTo(x, y + 32, tx, ty - 32, tx, ty)
      } else {
        const x = source.x + source.width, y = source.y + 32, tx = target.x, ty = target.y + 32
        ctx.moveTo(x, y); ctx.bezierCurveTo(x + 42, y, tx - 42, ty, tx, ty)
      }
      ctx.stroke()
    }
    ctx.restore()
  },
  onUnload() { this.disposed = true; if (this.drawTimer) clearTimeout(this.drawTimer); this.context = null; this.canvas = null },
  onShareAppMessage() { return { title: `${this.data.name} · 烹饪蓝图`, path: `/pages/blueprint/index?id=${encodeURIComponent(this.recipe?.id || '')}` } },
})
