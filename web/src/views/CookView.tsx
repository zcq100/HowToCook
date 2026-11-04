import { useCallback, useEffect, useRef, useState } from 'react'
import type { Recipe, Step } from '../types'
import { Inline } from '../inline'
import { formatClock, parseDuration, plainText, trimName } from '../recipeText'
import { timerStore, useTimers, type Timer } from '../timers'

/**
 * 烹饪模式：一屏一步、大字号，适合把手机立在灶台边。
 * 页序：准备（备料清单）→ 第 1…n 步 → 完成。
 * - 步骤里的时长变成计时按钮，计时器跨步骤 / 跨视图持续运行；
 * - 屏幕常亮（Wake Lock）、左右滑动 / 方向键翻页、可选语音朗读；
 * - 当前页和备料勾选记在 sessionStorage，手机刷新或误切走后能接着做。
 */
export default function CookView({ recipe }: { recipe: Recipe }) {
  const n = recipe.steps.length
  const lastPage = n + 1
  const [page, setPage] = useSession<number>(`cook:page:${recipe.id}`, 0)
  const [checked, setChecked] = useSession<string[]>(`cook:prep:${recipe.id}`, [])
  const [speak, setSpeak] = useLocal('cook:speak', false)
  const [keepAwake, setKeepAwake] = useLocal('cook:awake', true)
  const wake = useWakeLock(keepAwake)
  const stageRef = useRef<HTMLDivElement>(null)

  const go = useCallback((p: number) => setPage(Math.max(0, Math.min(lastPage, p))), [lastPage, setPage])
  const step = page >= 1 && page <= n ? recipe.steps[page - 1] : null

  // 翻页后回到顶部
  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 })
  }, [page])

  // 键盘：← → / 空格
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, button')) return
      if (e.key === 'ArrowRight' || e.key === ' ') (e.preventDefault(), go(page + 1))
      if (e.key === 'ArrowLeft') (e.preventDefault(), go(page - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, go])

  // 语音朗读：开启时朗读当前页
  useEffect(() => {
    if (!speak || !('speechSynthesis' in window)) return
    const text =
      page === 0
        ? `准备${recipe.name}。共 ${n} 步。`
        : step
          ? `第 ${step.index} 步。${plainText([step.text, ...step.notes].join('。'))}`
          : `${recipe.name}完成了。`
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = 0.95
    speechSynthesis.speak(u)
    return () => speechSynthesis.cancel()
  }, [speak, page, step, recipe.name, n])

  // 左右滑动翻页（纵向滑动用于滚动，不翻页）
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current.x
    const dy = t.clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(page + (dx < 0 ? 1 : -1))
  }

  const toggleCheck = (id: string) =>
    setChecked(checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id])

  return (
    <div className="cook">
      <div className="cook-progress" role="tablist" aria-label="步骤进度">
        {Array.from({ length: lastPage + 1 }, (_, p) => (
          <button
            key={p}
            role="tab"
            aria-selected={p === page}
            aria-label={p === 0 ? '准备' : p === lastPage ? '完成' : `第 ${p} 步`}
            className={'seg' + (p === page ? ' on' : p < page ? ' done' : '') + (p === 0 || p === lastPage ? ' edge' : '')}
            onClick={() => go(p)}
          />
        ))}
      </div>

      <div className="cook-stage" ref={stageRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {page === 0 && <PrepPage recipe={recipe} checked={checked} onToggle={toggleCheck} onStart={() => go(1)} />}
        {step && <StepPage recipe={recipe} step={step} />}
        {page === lastPage && <DonePage recipe={recipe} onRestart={() => go(0)} />}
      </div>

      <TimerTray recipe={recipe.name} />

      <div className="cook-nav">
        <button className="cook-prev" onClick={() => go(page - 1)} disabled={page === 0} aria-label="上一页">
          ←
        </button>
        <div className="cook-pos">
          <span className="cook-pos-main">{page === 0 ? '准备' : page === lastPage ? '完成' : `${page} / ${n}`}</span>
          <span className="cook-toggles">
            <button
              className={'cook-toggle' + (keepAwake && wake.active ? ' on' : '')}
              onClick={() => setKeepAwake(!keepAwake)}
              disabled={!wake.supported}
              title={!wake.supported ? '此浏览器不支持屏幕常亮' : keepAwake ? '屏幕常亮：开' : '屏幕常亮：关'}
            >
              常亮
            </button>
            <button
              className={'cook-toggle' + (speak ? ' on' : '')}
              onClick={() => setSpeak(!speak)}
              title={speak ? '语音朗读：开' : '语音朗读：关'}
            >
              朗读
            </button>
          </span>
        </div>
        <button className="cook-next" onClick={() => go(page + 1)} disabled={page === lastPage} aria-label="下一页">
          {page === 0 ? '开始' : page === n ? '完成' : '下一步'} →
        </button>
      </div>
    </div>
  )
}

function PrepPage({
  recipe,
  checked,
  onToggle,
  onStart,
}: {
  recipe: Recipe
  checked: string[]
  onToggle: (id: string) => void
  onStart: () => void
}) {
  const ingredients = recipe.ingredients.filter((i) => i.kind === 'ingredient')
  const tools = recipe.ingredients.filter((i) => i.kind === 'tool')
  const done = ingredients.filter((i) => checked.includes(i.id)).length
  return (
    <article className="cook-card">
      <p className="cook-kicker">准备 · {done} / {ingredients.length} 样已备好</p>
      <h2 className="cook-title">{recipe.name}</h2>
      {recipe.servingsNote && <p className="cook-sub">{recipe.servingsNote}</p>}
      <ul className="prep-list">
        {ingredients.map((i) => (
          <li key={i.id}>
            <label className={checked.includes(i.id) ? 'on' : ''}>
              <input type="checkbox" checked={checked.includes(i.id)} onChange={() => onToggle(i.id)} />
              <span className="prep-name">{i.name}</span>
              <span className="prep-amount">{i.amounts.map((a) => trimName(i.name, a)).join('；')}</span>
            </label>
          </li>
        ))}
      </ul>
      {tools.length > 0 && <p className="cook-sub">工具：{tools.map((t) => t.name).join('、')}</p>}
      <button className="cook-primary" onClick={onStart}>
        备好了，开始第 1 步 →
      </button>
    </article>
  )
}

function StepPage({ recipe, step }: { recipe: Recipe; step: Step }) {
  const uses = step.uses.map((u) => recipe.ingredients.find((i) => i.id === u)!).filter(Boolean)
  const durations = step.times.map(parseDuration).filter((d): d is NonNullable<typeof d> => !!d)
  return (
    <article className="cook-card" key={step.id}>
      <p className="cook-kicker">
        第 {step.index} 步 · 共 {recipe.steps.length} 步
        {step.heat && <span className="cook-heat">🔥 {step.heat}</span>}
      </p>
      <div className="cook-text">
        <Inline text={step.text} />
      </div>
      {step.notes.map((note, i) => (
        <div className="cook-note" key={i}>
          <Inline text={note} />
        </div>
      ))}

      {durations.length > 0 && (
        <div className="cook-timers">
          {durations.map((d, i) => (
            <button
              key={i}
              className="cook-timer-btn"
              onClick={() => timerStore.start(`第 ${step.index} 步 · ${d.label}`, recipe.name, d.seconds)}
            >
              ⏱ 计时 {d.label}
            </button>
          ))}
        </div>
      )}

      {uses.length > 0 && (
        <section className="cook-uses">
          <h3>这一步用到</h3>
          <ul>
            {uses.map((i) => (
              <li key={i.id}>
                <span>{i.name.replace(/[（(][^）)]*[）)]/g, '').trim() || i.name}</span>
                {i.amounts.length > 0 && <em>{i.amounts.map((a) => trimName(i.name, a)).join('；')}</em>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

function DonePage({ recipe, onRestart }: { recipe: Recipe; onRestart: () => void }) {
  return (
    <article className="cook-card cook-done">
      <p className="cook-kicker">完成</p>
      <h2 className="cook-title">{recipe.name}</h2>
      {recipe.images[0] && <img className="cook-done-img" src={recipe.images[0]} alt={recipe.name} />}
      <p className="cook-sub">出锅装盘，开饭。</p>
      {recipe.tips.length > 0 && (
        <section className="cook-uses">
          <h3>小贴士</h3>
          <ul className="cook-tips">
            {recipe.tips.slice(0, 4).map((t, i) => (
              <li key={i}>
                <Inline text={t} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <button className="cook-secondary" onClick={onRestart}>
        回到准备
      </button>
    </article>
  )
}

/** 运行中的计时器（包括其他菜谱的），到点后高亮并提示，点“关闭”移除 */
function TimerTray({ recipe }: { recipe: string }) {
  const timers = useTimers()
  if (!timers.length) return null
  return (
    <div className="timer-tray" aria-live="polite">
      {timers.map((t) => (
        <TimerChip key={t.id} t={t} showRecipe={t.recipe !== recipe} />
      ))}
    </div>
  )
}

function TimerChip({ t, showRecipe }: { t: Timer; showRecipe: boolean }) {
  const running = t.endAt !== null
  const pct = t.total ? 1 - t.remaining / t.total : 1
  return (
    <div className={'timer-chip' + (t.done ? ' done' : running ? ' running' : ' paused')}>
      <span className="timer-bar" style={{ width: `${Math.round(pct * 100)}%` }} />
      <span className="timer-clock">{t.done ? '时间到' : formatClock(t.remaining)}</span>
      <span className="timer-label">
        {showRecipe && <>{t.recipe} · </>}
        {t.label}
      </span>
      {!t.done && (
        <button onClick={() => (running ? timerStore.pause(t.id) : timerStore.resume(t.id))}>
          {running ? '暂停' : '继续'}
        </button>
      )}
      <button onClick={() => timerStore.remove(t.id)} aria-label="关闭计时器">
        {t.done ? '知道了' : '✕'}
      </button>
    </div>
  )
}

// ---- hooks ----

function useStored<T>(storage: () => Storage, key: string, initial: T) {
  const read = useCallback((): T => {
    try {
      const v = storage().getItem(key)
      return v === null ? initial : (JSON.parse(v) as T)
    } catch {
      return initial
    }
    // initial 只在首次读取时使用，不作为依赖
  }, [key])
  const [value, setValue] = useState<T>(read)
  // key 变化（换菜谱）时重新读取
  useEffect(() => {
    setValue(read())
  }, [read])
  const set = useCallback(
    (v: T) => {
      setValue(v)
      try {
        storage().setItem(key, JSON.stringify(v))
      } catch {
        /* 隐私模式等：只在内存中生效 */
      }
    },
    [key],
  )
  return [value, set] as const
}
const useSession = <T,>(key: string, initial: T) => useStored(() => sessionStorage, key, initial)
const useLocal = <T,>(key: string, initial: T) => useStored(() => localStorage, key, initial)

/** 屏幕常亮。页面切到后台时浏览器会自动释放，回到前台时重新申请 */
function useWakeLock(enabled: boolean) {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!enabled || !supported) return
    let lock: WakeLockSentinel | null = null
    let disposed = false
    const request = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        lock = await navigator.wakeLock.request('screen')
        if (disposed) return void lock.release()
        setActive(true)
        lock.addEventListener('release', () => setActive(false))
      } catch {
        setActive(false)
      }
    }
    void request()
    const onVisible = () => void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
      setActive(false)
    }
  }, [enabled, supported])
  return { supported, active }
}
