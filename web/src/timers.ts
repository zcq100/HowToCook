import { useSyncExternalStore } from 'react'

/**
 * 烹饪计时器。
 * 状态放在模块里而不是组件里：切换步骤、切到蓝图 / 图文再回来，计时都不会中断。
 * 以结束时间戳计算剩余时间，手机锁屏或后台标签页被节流时也不会走慢。
 */
export interface Timer {
  id: string
  label: string // 例如 “第 3 步 · 10 分钟”
  recipe: string
  total: number // 秒
  endAt: number | null // 运行中：结束时间戳；暂停或已结束：null
  remaining: number // 秒（暂停时的剩余值，运行中由 tick 刷新）
  done: boolean
}

let timers: Timer[] = []
const listeners = new Set<() => void>()
let tickHandle: number | undefined

function set(next: Timer[]) {
  timers = next
  listeners.forEach((l) => l())
  if (timers.some((t) => t.endAt !== null)) startTick()
  else stopTick()
}

function startTick() {
  if (tickHandle !== undefined) return
  tickHandle = window.setInterval(() => {
    const now = Date.now()
    let changed = false
    const next = timers.map((t) => {
      if (t.endAt === null) return t
      const remaining = Math.max(0, Math.ceil((t.endAt - now) / 1000))
      if (remaining === t.remaining) return t
      changed = true
      if (remaining === 0) {
        alarm()
        return { ...t, remaining: 0, endAt: null, done: true }
      }
      return { ...t, remaining }
    })
    if (changed) set(next)
  }, 250)
}

function stopTick() {
  if (tickHandle === undefined) return
  clearInterval(tickHandle)
  tickHandle = undefined
}

// ---- 提醒：提示音 + 振动 ----
let audio: AudioContext | null = null

/** 必须在用户手势（点“开始计时”）里调用一次，iOS 才允许之后自动播放提示音 */
function unlockAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

function beep(at: number, freq: number) {
  if (!audio) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
  osc.connect(gain).connect(audio.destination)
  osc.start(at)
  osc.stop(at + 0.4)
}

function alarm() {
  if (audio) {
    const t0 = audio.currentTime + 0.05
    // 三组“叮–咚”
    for (let i = 0; i < 3; i++) {
      beep(t0 + i * 0.9, 880)
      beep(t0 + i * 0.9 + 0.4, 660)
    }
  }
  navigator.vibrate?.([300, 150, 300, 150, 600])
}

// ---- 对外接口 ----
let seq = 0
export const timerStore = {
  start(label: string, recipe: string, seconds: number) {
    unlockAudio()
    const id = `t${Date.now()}-${seq++}`
    set([...timers, { id, label, recipe, total: seconds, endAt: Date.now() + seconds * 1000, remaining: seconds, done: false }])
    return id
  },
  pause(id: string) {
    set(timers.map((t) => (t.id === id && t.endAt !== null ? { ...t, endAt: null, remaining: Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000)) } : t)))
  },
  resume(id: string) {
    unlockAudio()
    set(timers.map((t) => (t.id === id && t.endAt === null && !t.done ? { ...t, endAt: Date.now() + t.remaining * 1000 } : t)))
  },
  remove(id: string) {
    set(timers.filter((t) => t.id !== id))
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  get: () => timers,
}

export const useTimers = () => useSyncExternalStore(timerStore.subscribe, timerStore.get)
