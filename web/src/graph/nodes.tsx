import { createContext, memo, useContext } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Ingredient, Recipe, Step } from '../types'
import { Inline, stars } from '../inline'
import { ingredientColor, type Direction } from './layout'

/** 图中的交互状态：当前执行到第几步、鼠标悬停 / 选中的节点 */
export interface GraphState {
  current: number // -1 = 尚未开始，steps.length = 已完成
  focus: string | null
  related: Set<string>
  setCurrent: (n: number) => void
  dir: Direction
}
export const GraphCtx = createContext<GraphState>({
  current: -1,
  focus: null,
  related: new Set(),
  setCurrent: () => {},
  dir: 'LR',
})

const dimClass = (g: GraphState, id: string) => (g.focus && !g.related.has(id) ? ' dim' : '')

/**
 * 执行引脚。LR 时放在“执行”行的左右两端；TB 时由 RowPins/NodePins 放到节点上下边缘。
 */
function ExecPin({ type }: { type: 'source' | 'target' }) {
  const { dir } = useContext(GraphCtx)
  const position =
    dir === 'TB' ? (type === 'source' ? Position.Bottom : Position.Top) : type === 'source' ? Position.Right : Position.Left
  return (
    <Handle
      type={type}
      id={type === 'source' ? 'exec-out' : 'exec-in'}
      position={position}
      className="pin-exec"
      isConnectable={false}
    />
  )
}

/** LR：引脚放在“执行”行里 */
function RowPin({ type }: { type: 'source' | 'target' }) {
  return useContext(GraphCtx).dir === 'LR' ? <ExecPin type={type} /> : null
}
/** TB：引脚直接挂在节点上，定位到上下边缘中点 */
function NodePin({ type }: { type: 'source' | 'target' }) {
  return useContext(GraphCtx).dir === 'TB' ? <ExecPin type={type} /> : null
}

export const EventNode = memo(({ id, data }: NodeProps) => {
  const g = useContext(GraphCtx)
  const recipe = data.recipe as Recipe
  return (
    <div className={'bp-node event' + dimClass(g, id) + (g.current === -1 ? ' running' : '')}>
      <NodePin type="source" />
      <div className="bp-header">
        <span className="bp-icon">◆</span> 事件 · 开始烹饪
      </div>
      <div className="bp-body">
        <div className="bp-row exec-row">
          <span />
          <span className="pin-label">执行</span>
          <RowPin type="source" />
        </div>
        {recipe.servingsNote && <p className="muted small">{recipe.servingsNote}</p>}
        <button className="bp-btn nodrag" onClick={() => g.setCurrent(0)}>
          ▶ 从第一步开始
        </button>
      </div>
    </div>
  )
})

export const IngredientNode = memo(({ id, data }: NodeProps) => {
  const g = useContext(GraphCtx)
  const ing = data.ingredient as Ingredient
  const color = data.color as string
  return (
    <div
      className={`bp-node pure ${ing.kind}` + (data.unlinked ? ' unlinked' : '') + dimClass(g, id)}
      style={{ ['--pin' as string]: color }}
    >
      <div className="bp-pure-head">
        <span className="kind-tag">{ing.kind === 'tool' ? '工具' : ing.extra ? '调料' : '原料'}</span>
        <span className="pure-name" title={ing.name}>
          {ing.name}
        </span>
        <Handle type="source" id="out" position={Position.Right} className="pin-data" isConnectable={false} />
      </div>
      {ing.amounts.length > 0 && (
        <ul className="amounts">
          {ing.amounts.map((a, i) => (
            <li key={i} title={a}>
              {a}
            </li>
          ))}
        </ul>
      )}
      {data.unlinked ? <div className="muted tiny">未在步骤中识别到</div> : null}
    </div>
  )
})

export const StepNode = memo(({ id, data }: NodeProps) => {
  const g = useContext(GraphCtx)
  const step = data.step as Step
  const recipe = data.recipe as Recipe
  const k = step.index - 1
  const state = g.current === k ? ' running' : g.current > k ? ' done' : ''
  const uses = step.uses.map((u) => recipe.ingredients.find((i) => i.id === u)!).filter(Boolean)
  return (
    <div className={'bp-node step' + state + dimClass(g, id)}>
      <NodePin type="target" />
      <NodePin type="source" />
      <div className="bp-header">
        <span className="bp-icon">ƒ</span> 步骤 {step.index}
        <span className="chips">
          {step.heat && <span className="chip heat">🔥 {step.heat}</span>}
          {step.times.slice(0, 2).map((t) => (
            <span key={t} className="chip time">⏱ {t}</span>
          ))}
        </span>
      </div>
      <div className="bp-body">
        {g.dir === 'LR' && (
          <div className="bp-row exec-row">
            <ExecPin type="target" />
            <span className="pin-label" />
            <ExecPin type="source" />
          </div>
        )}
        {uses.map((ing) => (
          <div className="bp-row" key={ing.id} style={{ ['--pin' as string]: ingredientColor(recipe, ing.id) }}>
            <Handle
              type="target"
              id={`in-${ing.id}`}
              position={Position.Left}
              className="pin-data"
              isConnectable={false}
            />
            <span className="pin-label">{ing.name.replace(/[（(][^）)]*[）)]/g, "").trim() || ing.name}</span>
          </div>
        ))}
        <div className="step-text">
          <Inline text={step.text} />
        </div>
        {step.notes.map((n, i) => (
          <div className="step-note" key={i}>
            <Inline text={n} />
          </div>
        ))}
        <div className="step-actions nodrag">
          {g.current === k ? (
            <button className="bp-btn" onClick={() => g.setCurrent(k + 1)}>
              ✓ 完成此步
            </button>
          ) : (
            <button className="bp-btn ghost" onClick={() => g.setCurrent(k)}>
              跳到这一步
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export const ResultNode = memo(({ id, data }: NodeProps) => {
  const g = useContext(GraphCtx)
  const recipe = data.recipe as Recipe
  const finished = g.current >= recipe.steps.length
  return (
    <div className={'bp-node result' + dimClass(g, id) + (finished ? ' running' : '')}>
      <NodePin type="target" />
      <div className="bp-header">
        <span className="bp-icon">★</span> 成品 · {recipe.name}
      </div>
      <div className="bp-body">
        <div className="bp-row exec-row">
          <RowPin type="target" />
          <span className="pin-label">出锅</span>
        </div>
        {recipe.images[0] && <img className="result-img" src={recipe.images[0]} alt={recipe.name} />}
        <div className="kv">
          <span>难度</span>
          <span className="stars">{stars(recipe.difficulty)}</span>
        </div>
        {recipe.calories && (
          <div className="kv">
            <span>热量</span>
            <span>{recipe.calories}</span>
          </div>
        )}
        {finished && <div className="done-banner">🎉 完成！开饭</div>}
      </div>
    </div>
  )
})

export const nodeTypes = {
  event: EventNode,
  ingredient: IngredientNode,
  step: StepNode,
  result: ResultNode,
}
