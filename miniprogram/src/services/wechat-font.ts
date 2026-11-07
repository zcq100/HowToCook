let fontReady: Promise<boolean> | undefined

/** Load WeChat's bundled font once; no font files or remote requests are needed. */
export function ensureWeChatFont(): Promise<boolean> {
  if (fontReady) return fontReady
  fontReady = new Promise(resolve => {
    if (typeof wx.loadBuiltInFontFace !== 'function') { resolve(false); return }
    // Some clients do not finish the callback. Fonts must never stall a page.
    const timeout = setTimeout(() => resolve(false), 1500)
    const finish = (loaded: boolean) => { clearTimeout(timeout); resolve(loaded) }
    try {
      wx.loadBuiltInFontFace({
        family: 'HowToCookWeChat',
        source: 'WeChatSansStd',
        global: true,
        scopes: ['webview'],
        success: () => finish(true),
        fail: error => { console.warn('WeChat built-in font unavailable:', error.errMsg); finish(false) },
      })
    } catch { finish(false) }
  })
  return fontReady
}
