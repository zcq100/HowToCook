import { useEffect, useMemo, useState, type ComponentType } from 'react'
import type { Recipe } from './types'
import { stars } from './inline'
import BlueprintView from './views/BlueprintView'
import TextView from './views/TextView'

/** 阅览方式注册表：新增视图只需在这里加一项 */
const VIEWS: { id: string; label: string; component: ComponentType<{ recipe: Recipe }> }[] = [
  { id: 'blueprint', label: '蓝图', component: BlueprintView },
  { id: 'text', label: '图文', component: TextView },
]

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

  useEffect(() => {
    fetch('data/recipes.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setRecipes)
      .catch((e) => setError(String(e)))
    const onHash = () => setRoute(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (view: string, id: string) => {
    location.hash = `${view}/${id}`
  }

  const categories = useMemo(() => {
    const m = new Map<string, string>()
    recipes?.forEach((r) => m.set(r.category, r.categoryName))
    return [...m]
  }, [recipes])

  const filtered = useMemo(() => {
    const q = query.trim()
    return (recipes ?? []).filter(
      (r) =>
        (category === 'all' || r.category === category) &&
        (!q || r.name.includes(q) || r.ingredients.some((i) => i.name.includes(q))),
    )
  }, [recipes, query, category])

  const recipe = recipes?.find((r) => r.id === route.id) ?? recipes?.find((r) => r.name === '可乐鸡翅') ?? recipes?.[0]
  const View = VIEWS.find((v) => v.id === route.view)!.component

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          HowToCook <span>菜谱蓝图</span>
        </div>
        <input
          className="search"
          placeholder="搜索菜名或原料…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="cats">
          <button className={category === 'all' ? 'on' : ''} onClick={() => setCategory('all')}>
            全部
          </button>
          {categories.map(([id, name]) => (
            <button key={id} className={category === id ? 'on' : ''} onClick={() => setCategory(id)}>
              {name}
            </button>
          ))}
        </div>
        <div className="count">{filtered.length} 道菜</div>
        <ul className="list">
          {filtered.map((r) => (
            <li key={r.id}>
              <button className={r.id === recipe?.id ? 'on' : ''} onClick={() => navigate(route.view, r.id)}>
                <span className="name">{r.name}</span>
                <span className="stars small">{stars(r.difficulty)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        {error && <div className="empty">数据加载失败：{error}（先运行 npm run data）</div>}
        {!recipes && !error && <div className="empty">加载中…</div>}
        {recipe && (
          <>
            <div className="topbar">
              <h1>{recipe.name}</h1>
              <span className="stars">{stars(recipe.difficulty)}</span>
              {recipe.calories && <span className="muted">{recipe.calories}</span>}
              <span className="muted">
                {recipe.ingredients.length} 种原料 · {recipe.steps.length} 步
              </span>
              <div className="tabs">
                {VIEWS.map((v) => (
                  <button key={v.id} className={v.id === route.view ? 'on' : ''} onClick={() => navigate(v.id, recipe.id)}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="view">
              <View recipe={recipe} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
