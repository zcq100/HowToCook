import { useEffect, useMemo, useState, type ComponentType } from 'react'
import type { Recipe } from './types'
import { stars } from './inline'
import { REPO_URL } from './config'
import { BookmarkIcon, GitHubIcon, MenuIcon, MoonIcon, PaperIcon, PrintIcon, ShareIcon, SunIcon } from './icons'
import ShareDialog from './ShareDialog'
import { printRecipe } from './print'
import { THEME_LABEL, THEME_ORDER, useTheme, type Theme } from './useTheme'
import { useFavorites } from './useFavorites'
import { CategoryIcon } from './categoryIcons'
import BlueprintView from './views/BlueprintView'
import TextView from './views/TextView'
import CookView from './views/CookView'

/** 阅览方式注册表：新增视图只需在这里加一项 */
const VIEWS: { id: string; label: string; component: ComponentType<{ recipe: Recipe; theme: Theme }> }[] = [
  { id: 'blueprint', label: '蓝图', component: BlueprintView },
  { id: 'text', label: '图文', component: TextView },
  { id: 'cook', label: '烹饪', component: CookView },
]

/** 分类筛选里“收藏夹”的特殊值 */
const FAVORITES = '__favorites__'

function readHash() {
  const [view, ...rest] = decodeURIComponent(location.hash.slice(1)).split('/')
  return { view: VIEWS.some((v) => v.id === view) ? view : 'blueprint', id: rest.join('/') }
}

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState(readHash)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const favorites = useFavorites()
  const [themeMenu, setThemeMenu] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    fetch('/data/recipes.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setRecipes)
      .catch((e) => setError(String(e)))
    const onHash = () => setRoute(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (view: string, id: string) => {
    location.hash = `${view}/${id}`
    setDrawerOpen(false)
  }

  const categories = useMemo(() => {
    const m = new Map<string, string>()
    recipes?.forEach((r) => m.set(r.category, r.categoryName))
    return [...m]
  }, [recipes])

  // 只统计仍然存在的菜谱（菜谱改名 / 删除后，旧收藏自动忽略）
  const favSet = useMemo(() => new Set(favorites.ids), [favorites.ids])
  const favCount = useMemo(() => (recipes ?? []).filter((r) => favSet.has(r.id)).length, [recipes, favSet])

  // 收藏夹清空后，退回“全部”
  useEffect(() => {
    if (category === FAVORITES && recipes && favCount === 0) setCategory('all')
  }, [category, favCount, recipes])

  const filtered = useMemo(() => {
    const q = query.trim()
    const list = (recipes ?? []).filter(
      (r) =>
        (category === 'all' || r.category === category || (category === FAVORITES && favSet.has(r.id))) &&
        (!q || r.name.includes(q) || r.ingredients.some((i) => i.name.includes(q))),
    )
    // 收藏夹按收藏时间排序，最近收藏的在前
    if (category === FAVORITES) list.sort((a, b) => favorites.ids.indexOf(a.id) - favorites.ids.indexOf(b.id))
    return list
  }, [recipes, query, category, favSet, favorites.ids])

  const recipe = recipes?.find((r) => r.id === route.id) ?? recipes?.find((r) => r.name === '可乐鸡翅') ?? recipes?.[0]
  const View = VIEWS.find((v) => v.id === route.view)!.component

  // 标签页标题跟随当前菜谱（分享短链进来时 worker 设置的标题也会被更新）
  useEffect(() => {
    if (recipe) document.title = `${recipe.name} · 菜谱蓝图`
  }, [recipe])

  return (
    <div className={'app' + (drawerOpen ? ' drawer-open' : '')}>
      <div className="backdrop" onClick={() => setDrawerOpen(false)} />
      <aside className="sidebar">
        <div className="brand">
          <span>
            <em>菜谱蓝图</em>
          </span>
          <span className="brand-actions">
            <span className="theme-picker">
              <button
                className="theme-btn"
                onClick={() => setThemeMenu((v) => !v)}
                title={`主题：${THEME_LABEL[theme]}`}
                aria-label={`主题：${THEME_LABEL[theme]}`}
                aria-haspopup="menu"
                aria-expanded={themeMenu}
              >
                <ThemeIcon theme={theme} />
              </button>
              {themeMenu && (
                <>
                  <div className="theme-menu-backdrop" onClick={() => setThemeMenu(false)} />
                  <ul className="theme-menu" role="menu">
                    {THEME_ORDER.map((t) => (
                      <li key={t}>
                        <button
                          role="menuitemradio"
                          aria-checked={t === theme}
                          className={t === theme ? 'on' : ''}
                          onClick={() => (setTheme(t), setThemeMenu(false))}
                        >
                          <ThemeIcon theme={t} />
                          {THEME_LABEL[t]}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </span>
            <a className="repo-link" href={REPO_URL} target="_blank" rel="noreferrer" title="GitHub 仓库">
              <GitHubIcon size={18} />
            </a>
          </span>
        </div>
        <input
          className="search"
          placeholder="搜索菜名或原料…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="cats">
          {favCount > 0 && (
            <button
              className={'fav-chip' + (category === FAVORITES ? ' on' : '')}
              onClick={() => setCategory(FAVORITES)}
            >
              <BookmarkIcon filled size={13} />
              收藏夹 <span className="chip-count">{favCount}</span>
            </button>
          )}
          <button className={category === 'all' ? 'on' : ''} onClick={() => setCategory('all')}>
            <CategoryIcon id="all" />
            全部
          </button>
          {categories.map(([id, name]) => (
            <button key={id} className={category === id ? 'on' : ''} onClick={() => setCategory(id)}>
              <CategoryIcon id={id} />
              {name}
            </button>
          ))}
        </div>
        <div className="count">{filtered.length} 道菜</div>
        <ul className="list">
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                className={r.id === recipe?.id ? 'on' : ''}
                onClick={() => navigate(route.view, r.id)}
                title={r.name}
              >
                <span className="name">
                  <span className="name-text">{r.name}</span>
                  {favSet.has(r.id) && category !== FAVORITES && (
                    <span className="fav-mark" aria-label="已收藏">
                      <BookmarkIcon filled size={12} />
                    </span>
                  )}
                </span>
                <span className="meta">
                  <span className="meta-text">
                    {(category === 'all' || category === FAVORITES) && <>{r.categoryName} · </>}
                    {r.calories ?? '热量未知'}
                  </span>
                  <Difficulty value={r.difficulty} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <a className="sidebar-foot" href={REPO_URL} target="_blank" rel="noreferrer">
          <GitHubIcon size={14} />
          zcq100/HowToCook
        </a>
      </aside>

      <main className="main">
        {error && <div className="empty">数据加载失败：{error}（先运行 npm run data）</div>}
        {!recipes && !error && <div className="empty">加载中…</div>}
        {recipe && (
          <>
            <div className="topbar">
              <button className="menu-btn" onClick={() => setDrawerOpen(true)} aria-label="打开菜谱列表">
                <MenuIcon />
              </button>
              <h1>{recipe.name}</h1>
              <button
                className={'fav-btn' + (favSet.has(recipe.id) ? ' on' : '')}
                onClick={() => favorites.toggle(recipe.id)}
                aria-pressed={favSet.has(recipe.id)}
                title={favSet.has(recipe.id) ? '取消收藏' : '收藏这道菜'}
              >
                <BookmarkIcon filled={favSet.has(recipe.id)} />
                <span className="fav-label">{favSet.has(recipe.id) ? '已收藏' : '收藏'}</span>
              </button>
              <span className="topbar-meta">
                <span className="stars">{stars(recipe.difficulty)}</span>
                {recipe.calories && <span className="muted">{recipe.calories}</span>}
                <span className="muted">
                  {recipe.ingredients.length} 种原料 · {recipe.steps.length} 步
                </span>
              </span>
              <button className="share-btn" onClick={() => setSharing(true)} title="分享这道菜">
                <ShareIcon />
                <span className="share-label">分享</span>
              </button>
              {route.view === 'text' && (
                <button className="print-btn" onClick={() => printRecipe(recipe)} title="打印这份配方">
                  <PrintIcon />
                  <span className="print-label">打印</span>
                </button>
              )}
              <div className="tabs">
                {VIEWS.map((v) => (
                  <button key={v.id} className={v.id === route.view ? 'on' : ''} onClick={() => navigate(v.id, recipe.id)}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="view">
              <View recipe={recipe} theme={theme} />
              {sharing && <ShareDialog recipe={recipe} onClose={() => setSharing(false)} />}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

/** 难度用 5 个等宽圆点表示，避免 ★☆ 在不同字体下宽度不一致导致对不齐 */
function Difficulty({ value }: { value: number }) {
  return (
    <span className="pips" role="img" aria-label={`难度 ${value} / 5`} title={`难度 ${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= value ? 'on' : ''} />
      ))}
    </span>
  )
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'light') return <SunIcon />
  if (theme === 'dark') return <MoonIcon />
  return <PaperIcon />
}
