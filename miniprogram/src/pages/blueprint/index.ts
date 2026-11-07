import { switchView } from '../../services/recipe-navigation'
import { ensureWeChatFont } from '../../services/wechat-font'
import { connectionsSvg, svgDataUrl } from '../../services/blueprint-connections'
import { repository } from '../../services/repository'
import { buildBlueprint, zoomAt, constrainCamera } from '../../services/blueprint'
import type { Camera, Graph, GraphNode } from '../../services/blueprint'
import type { Recipe } from '../../../../packages/recipe-core/types'

type ViewportInfo = { width: number; height: number; left: number; top: number }
type Touch = { clientX: number; clientY: number }
const center = (touches: Touch[]) => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 })
const distance = (touches: Touch[]) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

Page({
  data: { currentView: 'blueprint', nodes: [] as GraphNode[], name: '', error: '', loading: true, activeIndex: -1, total: 0, currentLabel: '尚未开始', x: 0, y: 0, scale: 1, width: 584, height: 0, surfaceTop: 0, surfaceHeight: 1, connectionsSrc: '' },
  recipeId: '',
  switchView,
  recipe: null as Recipe | null,
  graph: null as Graph | null,
  viewport: { width: 0, height: 0, left: 0, top: 0 },
  gesture: null as { touches: Touch[]; camera: Camera } | null,
  drawTimer: null as ReturnType<typeof setTimeout> | null,
  disposed: false,
  ready: false,
  targetCamera: null as Camera | null,
  cameraInFlight: false,
  renderedSurfaceTop: 0,
  surfaceDrawn: false,
  tapSuppressedUntil: 0,
  dragDistance: 0,
  initializing: false,
  renderedCamera: { x: 0, y: 0, scale: 1 } as Camera,
  async onLoad(options: Record<string, string | undefined>) {
    try {
      this.recipeId = decodeURIComponent(options.id || '')
      this.recipe = await repository.getRecipe(this.recipeId)
      if (this.disposed) return
      wx.setNavigationBarTitle({ title: this.recipe.name })
      this.graph = buildBlueprint(this.recipe)
      this.setData({ name: this.recipe.name, total: this.recipe.steps.length, nodes: this.graph.nodes, height: this.graph.height, loading: false })
      if (this.ready) this.initialize()
    } catch (error) { this.setData({ loading: false, error: error instanceof Error ? error.message : '蓝图加载失败' }) }
  },
  onReady() { this.ready = true; if (this.graph) this.initialize() },
  initialize() {
    if (this.initializing || this.disposed) return
    this.initializing = true
    // Connection initialization must not depend on a font callback on iOS.
    void ensureWeChatFont().then(loaded => {
      if (loaded && !this.disposed && this.surfaceDrawn) wx.nextTick(() => this.measureNodes(false))
    })
    wx.nextTick(() => {
      if (this.disposed) return
      this.createSelectorQuery().select('.graph-viewport').boundingClientRect().exec(results => {
        const viewport = results[0] as ViewportInfo | null
        if (!viewport?.width || !viewport.height || !this.graph || this.disposed) { this.setData({ error: '蓝图初始化失败，请返回后重试' }); return }
        this.viewport = viewport
        const surfaceHeight = Math.min(this.graph.height, 2560, Math.ceil(viewport.height / .45) + 384)
        this.setData({ surfaceHeight }, () => { if (!this.disposed) this.measureNodes() })
      })
    })
  },
  measureNodes(reset = true) {
    this.createSelectorQuery().selectAll('.graph-node').boundingClientRect().exec(allResults => {
      const results = allResults[0]
      if (!this.recipe || this.disposed) return
      const heights: Record<string, number> = {}
      for (const result of results as WechatMiniprogram.BoundingClientRectCallbackResult[]) {
        if (result.dataset?.id) heights[result.dataset.id] = result.height / this.renderedCamera.scale
      }
      this.graph = buildBlueprint(this.recipe, heights)
      const used = new Set(this.recipe.steps[this.data.activeIndex]?.uses || [])
      const nodes = this.graph.nodes.map((node: GraphNode) => ({ ...node, active: node.stepIndex === this.data.activeIndex && node.kind === 'step' || used.has(node.id) }))
      this.setData({ nodes, height: this.graph.height }, () => {
        this.surfaceDrawn = false
        if (reset) this.resetView()
        else this.moveCamera(this.camera())
      })
    })
  },
  camera(): Camera { return this.targetCamera || { x: this.data.x, y: this.data.y, scale: this.data.scale } },
  moveCamera(camera: Camera) {
    if (!this.graph) return
    this.targetCamera = constrainCamera(camera, this.graph, this.viewport)
    this.flushCamera()
  },
  flushCamera() {
    if (this.cameraInFlight || !this.targetCamera || !this.graph || this.disposed) return
    const camera = { ...this.targetCamera }
    const top = Math.max(0, -camera.y / camera.scale)
    const bottom = top + this.viewport.height / camera.scale
    let surfaceTop = this.data.surfaceTop
    if (top < surfaceTop + 96 || bottom > surfaceTop + this.data.surfaceHeight - 96) {
      surfaceTop = Math.max(0, Math.min(this.graph.height - this.data.surfaceHeight, Math.floor(top - 192)))
    }
    this.cameraInFlight = true
    const redraw = !this.surfaceDrawn || surfaceTop !== this.renderedSurfaceTop || camera.scale !== this.renderedCamera.scale
    const connectionData = redraw ? { connectionsSrc: svgDataUrl(connectionsSvg(this.graph, surfaceTop, this.data.surfaceHeight, camera.scale, this.data.activeIndex)) } : {}
    // Image source, image bounds and node transform commit together.
    this.setData({ ...camera, surfaceTop, ...connectionData }, () => {
      this.cameraInFlight = false
      if (this.disposed) return
      this.renderedCamera = camera
      this.renderedSurfaceTop = surfaceTop
      this.surfaceDrawn = true
      const latest = this.targetCamera
      if (latest && (latest.x !== camera.x || latest.y !== camera.y || latest.scale !== camera.scale)) this.flushCamera()
    })
  },
  resetView() {
    const scale = Math.min(1, Math.max(.45, (this.viewport.width - 24) / 584))
    this.moveCamera({ x: (this.viewport.width - 584 * scale) / 2, y: 16, scale })
  },
  onTouchStart(event: WechatMiniprogram.TouchEvent) { this.dragDistance = 0; this.gesture = { touches: event.touches.map(t => ({ clientX: t.clientX, clientY: t.clientY })), camera: this.camera() } },
  onTouchMove(event: WechatMiniprogram.TouchEvent) {
    const gesture = this.gesture
    if (!gesture) return
    const touches = event.touches
    if (touches.length && gesture.touches.length) {
      this.dragDistance += Math.hypot(touches[0].clientX - gesture.touches[0].clientX, touches[0].clientY - gesture.touches[0].clientY)
      if (this.dragDistance > 6 || touches.length >= 2) this.tapSuppressedUntil = Date.now() + 300
    }
    if (touches.length !== gesture.touches.length) { this.onTouchStart(event); return }
    if (touches.length >= 2) {
      const start = center(gesture.touches), now = center(touches)
      const next = zoomAt(gesture.camera, gesture.camera.scale * distance(touches) / Math.max(1, distance(gesture.touches)), start.x - this.viewport.left, start.y - this.viewport.top)
      this.moveCamera({ ...next, x: next.x + now.x - start.x, y: next.y + now.y - start.y })
    } else if (touches.length === 1) this.moveCamera({ ...gesture.camera, x: gesture.camera.x + touches[0].clientX - gesture.touches[0].clientX, y: gesture.camera.y + touches[0].clientY - gesture.touches[0].clientY })
    this.gesture = { touches: touches.map(t => ({ clientX: t.clientX, clientY: t.clientY })), camera: this.camera() }
  },
  onTouchEnd(event: WechatMiniprogram.TouchEvent) { if (event.touches.length) this.onTouchStart(event); else this.gesture = null },
  selectNode(event: WechatMiniprogram.TouchEvent) {
    if (Date.now() < this.tapSuppressedUntil) return
    const index = Number(event.currentTarget.dataset.index)
    if (index >= 0) this.selectStep(index, false)
  },
  previousStep() { this.selectStep(Math.max(0, this.data.activeIndex - 1), true) },
  nextStep() { this.selectStep(Math.min(this.data.total - 1, this.data.activeIndex + 1), true) },
  selectStep(index: number, locate: boolean) {
    if (!this.graph || !this.recipe?.steps[index]) return
    const step = this.recipe.steps[index]
    const used = new Set(step.uses)
    this.setData({ activeIndex: index, currentLabel: `第 ${index + 1} / ${this.data.total} 步`, nodes: this.graph.nodes.map((node: GraphNode) => ({ ...node, active: node.id === step.id || used.has(node.id) })) })
    if (locate) {
      const node = this.graph.nodes.find((n: GraphNode) => n.id === step.id)!
      const scale = Math.max(.8, this.camera().scale)
      this.moveCamera({ scale, x: this.viewport.width / 2 - (node.x + node.width / 2) * scale, y: 24 - node.y * scale })
    } else this.scheduleDraw()
  },
  scheduleDraw() { if (!this.drawTimer) this.drawTimer = setTimeout(() => { this.drawTimer = null; this.drawConnections() }, 16) },
  drawConnections() {
    if (!this.graph || this.disposed) return
    const svg = connectionsSvg(this.graph, this.data.surfaceTop, this.data.surfaceHeight, this.data.scale, this.data.activeIndex)
    this.setData({ connectionsSrc: svgDataUrl(svg) })
  },
  onConnectionsError(event: WechatMiniprogram.CustomEvent<{ errMsg: string }>) {
    console.warn('Blueprint connection image failed:', event.detail.errMsg)
    this.setData({ error: '蓝图加载失败，请重新打开' })
  },
  onUnload() { this.disposed = true; if (this.drawTimer) clearTimeout(this.drawTimer) },
  onShareAppMessage() { return { title: `${this.data.name} · 烹饪蓝图`, path: `/pages/blueprint/index?id=${encodeURIComponent(this.recipe?.id || '')}` } },
})
