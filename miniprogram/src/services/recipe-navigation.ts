/** Replace sibling views so switching tabs never grows the page stack. */
export function switchView(this: { recipeId: string; data: { currentView: string } }, event: WechatMiniprogram.TouchEvent) {
  const view = event.currentTarget.dataset.view
  if (!['recipe', 'blueprint', 'cook'].includes(view) || view === this.data.currentView || !this.recipeId) return
  wx.redirectTo({ url: `/pages/${view}/index?id=${encodeURIComponent(this.recipeId)}` })
}
