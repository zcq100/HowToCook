import { repository } from '../../services/repository'
import type { Recipe } from '../../../../packages/recipe-core/types'

type RecipeView = Omit<Recipe, 'ingredients' | 'steps'> & {
  ingredients: (Recipe['ingredients'][number] & { amountsText: string })[]
  steps: (Recipe['steps'][number] & { timeLabel: string })[]
}

Page({
  data: { recipe: null as RecipeView | null, loading: true, error: '' },
  recipeId: '',
  onLoad(options: Record<string, string | undefined>) {
    try { this.recipeId = decodeURIComponent(options.id || '') }
    catch { this.setData({ loading: false, error: '菜谱链接格式不正确' }); return }
    void this.loadRecipe()
  },
  async loadRecipe() {
    this.setData({ loading: true, error: '' })
    try {
      const recipe = await repository.getRecipe(this.recipeId)
      this.setData({ recipe: { ...recipe,
        ingredients: recipe.ingredients.map(item => ({ ...item, amountsText: item.amounts.join('；') || '按原文及实际需要准备' })),
        steps: recipe.steps.map(step => ({ ...step, timeLabel: step.times.join(' / ') })),
      } })
      wx.setNavigationBarTitle({ title: recipe.name })
    } catch (error) { this.setData({ error: error instanceof Error ? error.message : '加载失败，请重试' }) }
    finally { this.setData({ loading: false }) }
  },
  onRetry() { void this.loadRecipe() },
  openBlueprint() { wx.navigateTo({ url: `/pages/blueprint/index?id=${encodeURIComponent(this.recipeId)}` }) },
  goHome() { wx.reLaunch({ url: '/pages/index/index' }) },
  onShareAppMessage() {
    return { title: this.data.recipe?.name || '家常菜谱', path: `/pages/recipe/index?id=${encodeURIComponent(this.recipeId)}` }
  },
})
