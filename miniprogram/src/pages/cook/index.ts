import { trimName } from '../../services/recipe-text'
import { repository } from '../../services/repository'
import { switchView } from '../../services/recipe-navigation'
import type { Recipe, Ingredient, Step } from '../../../../packages/recipe-core/types'

type Supply = Ingredient & { amountsText: string }
type CookStep = Step & { timeLabel: string }
type SavedProgress = { stepId?: string; completed?: boolean }
Page({
  data: { currentView: 'cook', name: '', loading: true, error: '', stepIndex: 0, total: 0, completed: false, step: null as CookStep | null, supplies: [] as Supply[], tips: [] as string[], progress: 0, stepSegments: [] as number[] },
  recipeId: '',
  recipe: null as Recipe | null,
  switchView,
  onLoad(options: Record<string, string | undefined>) {
    try { this.recipeId = decodeURIComponent(options.id || '') }
    catch { this.setData({ loading: false, error: '菜谱链接格式不正确' }); return }
    void this.loadRecipe()
  },
  async loadRecipe() {
    this.setData({ loading: true, error: '' })
    try {
      const recipe = await repository.getRecipe(this.recipeId)
      if (!recipe.steps.length) throw new Error('这道菜暂无跟做步骤')
      this.recipe = recipe
      let saved: SavedProgress = {}
      try { saved = wx.getStorageSync(`cook:${recipe.id}`) || {} } catch { /* Reading remains available without storage. */ }
      const savedIndex = recipe.steps.findIndex(step => step.id === saved.stepId)
      this.setData({ name: recipe.name, stepSegments: recipe.steps.map((_, index) => index), total: recipe.steps.length, tips: recipe.tips, completed: savedIndex >= 0 && saved.completed === true })
      this.showStep(Math.max(0, savedIndex))
      wx.setNavigationBarTitle({ title: recipe.name })
    } catch (error) { this.setData({ error: error instanceof Error ? error.message : '跟做加载失败，请重试' }) }
    finally { this.setData({ loading: false }) }
  },
  showStep(index: number) {
    const recipe = this.recipe as Recipe | null
    if (!recipe?.steps[index]) return
    const step = recipe.steps[index]
    const used = new Set(step.uses)
    const supply = (item: Ingredient): Supply => ({ ...item, amountsText: item.amounts.map(amount => trimName(item.name, amount)).join('；') || '按需准备' })
    this.setData({ stepIndex: index, step: { ...step, timeLabel: step.times.join(' / ') }, supplies: recipe.ingredients.filter(item => used.has(item.id)).map(supply), progress: Math.round((index + 1) / recipe.steps.length * 100) })
  },
  saveProgress() {
    if (!this.data.step) return
    try { wx.setStorageSync(`cook:${this.recipeId}`, { stepId: this.data.step.id, completed: this.data.completed }) }
    catch { wx.showToast({ title: '进度未能保存', icon: 'none' }) }
  },
  previousStep() { if (this.data.stepIndex > 0) { this.setData({ completed: false }); this.showStep(this.data.stepIndex - 1); this.saveProgress(); wx.pageScrollTo({ scrollTop: 0, duration: 0 }) } },
  nextStep() {
    if (this.data.stepIndex < this.data.total - 1) { this.showStep(this.data.stepIndex + 1); wx.pageScrollTo({ scrollTop: 0, duration: 0 }) }
    else this.setData({ completed: true })
    this.saveProgress()
  },
  restart() { this.setData({ completed: false }); this.showStep(0); this.saveProgress() },
  onRetry() { void this.loadRecipe() },
  onShareAppMessage() { return { title: `${this.data.name} · 一起跟做`, path: `/pages/cook/index?id=${encodeURIComponent(this.recipeId)}` } },
})
