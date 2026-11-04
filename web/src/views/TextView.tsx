import type { Recipe } from '../types'
import { Inline, stars } from '../inline'

/** 传统图文视图：作为对照，也方便后续扩展更多阅览方式 */
export default function TextView({ recipe }: { recipe: Recipe }) {
  const ingredients = recipe.ingredients.filter((i) => i.kind === 'ingredient')
  const tools = recipe.ingredients.filter((i) => i.kind === 'tool')
  return (
    <article className="text-view">
      <header>
        <h1>{recipe.name}</h1>
        <p className="meta">
          <span className="stars">{stars(recipe.difficulty)}</span>
          {recipe.calories && <span>{recipe.calories}</span>}
          <span>{recipe.categoryName}</span>
        </p>
        {recipe.images.map((src) => (
          <img key={src} src={src} alt={recipe.name} />
        ))}
        {recipe.description && <p className="desc">{recipe.description}</p>}
      </header>

      <section>
        <h2>原料{recipe.servingsNote && <small>（{recipe.servingsNote}）</small>}</h2>
        <table>
          <tbody>
            {ingredients.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i.amounts.join('；') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tools.length > 0 && <p className="muted">工具：{tools.map((t) => t.name).join('、')}</p>}
      </section>

      <section>
        <h2>操作</h2>
        <ol className="steps">
          {recipe.steps.map((s) => (
            <li key={s.id}>
              <Inline text={s.text} />
              {s.notes.map((n, i) => (
                <div className="step-note" key={i}>
                  <Inline text={n} />
                </div>
              ))}
            </li>
          ))}
        </ol>
      </section>

      {recipe.tips.length > 0 && (
        <section>
          <h2>附加内容</h2>
          <ul>
            {recipe.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
