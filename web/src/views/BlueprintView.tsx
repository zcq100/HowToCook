import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
} from '@xyflow/react'
import type { Recipe } from '../types'
import { buildGraph } from '../graph/layout'
import { GraphCtx, nodeTypes, type GraphState } from '../graph/nodes'
import { useIsMobile } from '../useMediaQuery'
import { flowColorMode, type Theme } from '../useTheme'

/** 蓝图视图：像 UE 蓝图一样，用执行线串起步骤，原料以数据引脚接入步骤 */
export default function BlueprintView({ recipe, theme }: { recipe: Recipe; theme: Theme }) {
  return (
    <ReactFlowProvider>
      <Blueprint key={recipe.id} recipe={recipe} theme={theme} />
    </ReactFlowProvider>
  )
}

function Blueprint({ recipe, theme }: { recipe: Recipe; theme: Theme }) {
  const graph = useMemo(() => buildGraph(recipe), [recipe])
  const [nodes, , onNodesChange] = useNodesState(graph.nodes)
  const [current, setCurrent] = useState(-1)
  const [focus, setFocus] = useState<string | null>(null)
  const flow = useReactFlow()
  const isMobile = useIsMobile()

  // 悬停节点时，高亮与之直接相连的节点
  const related = useMemo(() => {
    const s = new Set<string>()
    if (!focus) return s
    s.add(focus)
    for (const e of graph.edges) {
      if (e.source === focus) s.add(e.target)
      if (e.target === focus) s.add(e.source)
    }
    return s
  }, [focus, graph.edges])

  const go = useCallback(
    (n: number) => {
      const next = Math.max(-1, Math.min(recipe.steps.length, n))
      setCurrent(next)
      const id = next < 0 ? 'start' : next >= recipe.steps.length ? 'result' : recipe.steps[next].id
      const node = flow.getNode(id)
      if (node) {
        const w = node.measured?.width ?? 300
        flow.setCenter(node.position.x + w / 2, node.position.y + 160, { zoom: 0.95, duration: 450 })
      }
    },
    [flow, recipe.steps],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'ArrowRight' || e.key === ' ') (e.preventDefault(), go(current + 1))
      if (e.key === 'ArrowLeft') go(current - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, go])

  const edges: Edge[] = useMemo(() => {
    const currentStepId = recipe.steps[current]?.id
    return graph.edges.map((e) => {
      const d = e.data as { kind: string; color?: string; order?: number }
      const touchesFocus = focus && (e.source === focus || e.target === focus)
      const dim = focus && !touchesFocus
      if (d.kind === 'exec') {
        const lit = d.order! <= current
        return {
          ...e,
          animated: d.order === current,
          className: 'edge-exec' + (lit ? ' lit' : '') + (dim ? ' dim' : ''),
        }
      }
      const feeding = e.target === currentStepId
      return {
        ...e,
        animated: feeding,
        style: { stroke: d.color },
        className: 'edge-data' + (feeding || touchesFocus ? ' hot' : '') + (dim ? ' dim' : ''),
      }
    })
  }, [graph.edges, current, focus, recipe.steps])

  // 初始视野：开始节点 + 前两步及其原料，保证文字可读；全貌看右下角小地图
  // 手机上只对准开始节点，保证字号可读；之后由“下一步”逐个居中步骤
  const initialView = useMemo(() => {
    const ids = isMobile
      ? ['start']
      : ['start', ...recipe.steps.slice(0, 2).flatMap((s) => [s.id, ...s.uses])]
    return { nodes: [...new Set(ids)].map((id) => ({ id })), padding: 0.12, maxZoom: isMobile ? 0.9 : 1 }
  }, [recipe.steps, isMobile])

  const ctx: GraphState = useMemo(() => ({ current, focus, related, setCurrent: go }), [current, focus, related, go])

  const stepLabel =
    current < 0 ? '未开始' : current >= recipe.steps.length ? '已完成' : `第 ${current + 1} / ${recipe.steps.length} 步`

  return (
    <GraphCtx.Provider value={ctx}>
      <div className="blueprint">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeMouseEnter={(_, n) => !isMobile && setFocus(n.id)}
          onNodeMouseLeave={() => !isMobile && setFocus(null)}
          // 触屏没有悬停：点按节点切换高亮，点空白处取消
          onNodeClick={(_, n) => isMobile && setFocus((f) => (f === n.id ? null : n.id))}
          onPaneClick={() => setFocus(null)}
          nodesConnectable={false}
          fitView
          fitViewOptions={initialView}
          minZoom={0.15}
          colorMode={flowColorMode(theme)}
          attributionPosition={isMobile ? 'top-right' : 'bottom-right'}
        >
          {theme === 'paper' ? (
            // 纸质主题用细点阵，不用网格线
            <Background id="dots" variant={BackgroundVariant.Dots} gap={22} size={1.3} color="var(--grid-major)" />
          ) : (
            <>
              <Background id="minor" variant={BackgroundVariant.Lines} gap={16} color="var(--grid-minor)" />
              <Background id="major" variant={BackgroundVariant.Lines} gap={128} color="var(--grid-major)" lineWidth={1.5} />
            </>
          )}
          {!isMobile && <Controls showInteractive={false} />}
          {!isMobile && <MiniMap pannable zoomable nodeColor={miniColor(theme)} maskColor={MASK[theme]} />}
        </ReactFlow>
        <div className="bp-toolbar">
          <button onClick={() => go(current - 1)} disabled={current < 0} aria-label="上一步">
            ← <span className="btn-text">上一步</span>
          </button>
          <span className="bp-progress">{stepLabel}</span>
          <button onClick={() => go(current + 1)} disabled={current >= recipe.steps.length} aria-label="下一步">
            <span className="btn-text">下一步</span> →
          </button>
          <button className="ghost" onClick={() => (setCurrent(-1), flow.fitView({ ...initialView, duration: 400 }))}>
            重置
          </button>
          {!isMobile && <span className="hint">键盘 ← → 切换步骤 · 悬停节点查看连线</span>}
        </div>
      </div>
    </GraphCtx.Provider>
  )
}

const MASK: Record<Theme, string> = {
  dark: 'rgba(0,0,0,.55)',
  light: 'rgba(240,238,232,.7)',
  paper: 'rgba(244,236,219,.75)',
}

const MINI: Record<Theme, Record<string, string>> = {
  dark: { step: '#3a6ea5', event: '#a33', result: '#b8892b', ingredient: '#4a7a3a' },
  light: { step: '#3a6ea5', event: '#a33', result: '#b8892b', ingredient: '#4a7a3a' },
  paper: { step: '#33414f', event: '#7a2e26', result: '#8f7034', ingredient: '#8a9a78' },
}
const miniColor = (theme: Theme) => (n: { type?: string }) => MINI[theme][n.type ?? 'ingredient'] ?? MINI[theme].ingredient
