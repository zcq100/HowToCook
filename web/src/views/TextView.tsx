import type { Recipe } from '../types'
import { Inline, stars } from '../inline'
import { sourceUrl } from '../config'
import { GitHubIcon } from '../icons'
import { CategoryIcon } from '../categoryIcons'

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
          <span className="meta-cat">
            <CategoryIcon id={recipe.category} size={15} />
            {recipe.categoryName}
          </span>
        </p>
        {recipe.images.length > 0 && (
          <div className={'gallery' + (recipe.images.length > 1 ? ' multi' : '')}>
            {recipe.images.map((src, i) => (
              <img key={src} src={src} alt={`${recipe.name} ${i + 1}`} loading={i ? 'lazy' : 'eager'} decoding="async" />
            ))}
          </div>
        )}
        {recipe.description && <p className="desc">{recipe.description}</p>}
      </header>

      <section>
        <h2>原料{recipe.servingsNote && <small>（{recipe.servingsNote}）</small>}</h2>
        <table>
          <tbody>
            {ingredients.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i.amounts.map((a) => trimName(i.name, a)).join('；') || '—'}</td>
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
              <li key={i}>
                <Inline text={t} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="source-link">
        <a href={sourceUrl(recipe.id)} target="_blank" rel="noreferrer">
          <GitHubIcon size={14} /> 在 GitHub 查看原文 / 提交修改
        </a>
      </footer>
    </article>
  )
}

/**
 * 用量行通常以原料名开头（“可乐 500ml”），在原料表里重复显示名称没有意义。
 * 若开头的词与原料名互相包含（“鸡翅 10 只” / 原料“鸡翅中”），就去掉它。
 */
function trimName(name: string, amount: string) {
  const m = amount.match(/^([^\s:：\d]+)[\s:：]+(.+)$/)
  if (!m) return amount
  const base = name.replace(/[（(][^）)]*[）)]/g, '')
  return base.includes(m[1]) || m[1].includes(base) ? m[2] : amount
}
