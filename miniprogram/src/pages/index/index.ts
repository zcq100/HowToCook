import { repository } from '../../services/repository'

Page({
  data: { categories: [] as Awaited<ReturnType<typeof repository.listCategories>>, recipes: [] as Awaited<ReturnType<typeof repository.listRecipes>>['items'], category: '', query: '', loading: true, error: '', nextCursor: null as string | null },
  requestVersion: 0,
  async onLoad() {
    try { this.setData({ categories: await repository.listCategories() }) }
    catch { this.setData({ error: '分类加载失败，请重试' }) }
    await this.loadRecipes()
  },
  async loadRecipes(append = false) {
    const version = ++this.requestVersion
    this.setData({ loading: true, error: '' })
    try {
      const result = await repository.listRecipes({ category: this.data.category, q: this.data.query, cursor: append ? this.data.nextCursor || undefined : undefined })
      if (version !== this.requestVersion) return
      this.setData({ recipes: append ? [...this.data.recipes, ...result.items] : result.items, nextCursor: result.nextCursor })
    } catch { if (version === this.requestVersion) this.setData({ error: '菜谱加载失败，请重试' }) }
    finally { if (version === this.requestVersion) this.setData({ loading: false }) }
  },
  onQuery(event: WechatMiniprogram.Input) { this.setData({ query: event.detail.value }); void this.loadRecipes() },
  onCategory(event: WechatMiniprogram.TouchEvent) { this.setData({ category: event.currentTarget.dataset.id }); void this.loadRecipes() },
  onRetry() { void this.onLoad() },
  onReachBottom() { if (!this.data.loading && this.data.nextCursor) void this.loadRecipes(true) },
  openRecipe(event: WechatMiniprogram.TouchEvent) { wx.navigateTo({ url: `/pages/recipe/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }) },
  onShareAppMessage() { return { title: '今天做什么？选一道家常菜', path: '/pages/index/index' } },
})
