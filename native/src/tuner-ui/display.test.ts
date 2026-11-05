import { describe, expect, it } from 'vitest'
import {
  CONFIRM_HOLD_MS,
  HISTORY_MAX,
  HISTORY_THROTTLE_MS,
  STICKY_HOLD_MS,
  centsTone,
  initialView,
  median,
  robustMedian,
  narrative,
  reduceView,
  type TunerView,
  type ViewConfig,
} from './display'

const CFG: ViewConfig = { referenceA4: 440, inTuneCents: 5 }
const hz = (midi: number, cents = 0, a4 = 440) => a4 * 2 ** ((midi - 69 + cents / 100) / 12)

function feed(
  v: TunerView,
  frames: (number | null)[],
  t0: number,
  dt = 43,
  cfg = CFG,
): { v: TunerView; t: number } {
  let t = t0
  for (const f of frames) {
    v = reduceView(v, { type: 'sample', sample: { frequency: f ?? 0, clarity: f ? 0.95 : 0.3, rms: 0.01 }, at: t }, cfg)
    t += dt
  }
  return { v, t }
}
const tick = (v: TunerView, at: number, cfg = CFG) => reduceView(v, { type: 'tick', at }, cfg)

describe('median', () => {
  it('odd and even', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 4])).toBe(2.5)
    expect(median([7])).toBe(7)
  })
  it('robustMedian never invents a value', () => {
    expect(robustMedian([69, 64], 69)).toBe(69)
    expect(robustMedian([69, 64], null)).toBe(64)
    expect(robustMedian([69, 64, 64], 69)).toBe(64)
  })
})

describe('sticky note', () => {
  it('holds through rejected frames and expires after STICKY_HOLD_MS', () => {
    let { v, t } = feed(initialView(CFG), [hz(69), hz(69)], 0)
    expect(v.note?.midi).toBe(69)
    const lastAccepted = v.lastAcceptedAt
    ;({ v, t } = feed(v, [null, null, null, null], t))
    expect(v.note?.midi).toBe(69)
    v = tick(v, lastAccepted + STICKY_HOLD_MS - 1)
    expect(v.note).not.toBeNull()
    v = tick(v, lastAccepted + STICKY_HOLD_MS)
    expect(v.note).toBeNull()
    expect(v.medianBuf).toEqual([])
    expect(v.ema).toBeNull()
  })

  it('returns the same object for no-op events', () => {
    const v0 = initialView(CFG)
    expect(tick(v0, 100)).toBe(v0)
    const { v } = feed(v0, [null], 0)
    expect(v).toBe(v0)
  })
})

describe('smoothing', () => {
  it('rejects a single octave outlier', () => {
    const { v } = feed(initialView(CFG), [hz(45), hz(45), hz(57), hz(45)], 0)
    expect(v.note?.midi).toBe(45)
    // and the outlier frame itself didn't flip the note
    const mid = feed(initialView(CFG), [hz(45), hz(45), hz(57)], 0).v
    expect(mid.note?.midi).toBe(45)
  })

  it('EMA converges to a steady pitch', () => {
    let { v } = feed(initialView(CFG), [hz(69, 0)], 0)
    expect(v.note!.cents).toBeCloseTo(0, 5)
    ;({ v } = feed(v, Array(12).fill(hz(69, 10)), 43))
    expect(v.note!.cents).toBeCloseTo(10, 1)
  })

  it('damps jitter', () => {
    const frames = Array.from({ length: 20 }, (_, i) => hz(69, i % 2 ? 8 : -8))
    const { v } = feed(initialView(CFG), frames, 0)
    expect(Math.abs(v.note!.cents)).toBeLessThan(8)
  })

  it('resets EMA on note change', () => {
    let { v } = feed(initialView(CFG), Array(6).fill(hz(69, 20)), 0)
    ;({ v } = feed(v, [hz(71, -10), hz(71, -10)], 400))
    expect(v.note?.midi).toBe(71)
    expect(v.note!.cents).toBeCloseTo(-10, 1)
  })

  it('A4 change clears the note and re-references', () => {
    let { v } = feed(initialView(CFG), [hz(69), hz(69)], 0)
    const cfg442 = { ...CFG, referenceA4: 442 }
    v = tick(v, 100, cfg442)
    expect(v.note).toBeNull()
    ;({ v } = feed(v, [442, 442], 200, 43, cfg442))
    expect(v.note?.midi).toBe(69)
    expect(v.note!.cents).toBeCloseTo(0, 5)
  })
})

describe('hold-to-confirm', () => {
  it('confirms after CONFIRM_HOLD_MS in band and counts once', () => {
    let { v, t } = feed(initialView(CFG), [hz(69, 2)], 0)
    expect(v.inTuneSince).toBe(0)
    expect(v.confirmed).toBe(false)
    ;({ v, t } = feed(v, Array(40).fill(hz(69, 2)), t))
    expect(t).toBeGreaterThan(CONFIRM_HOLD_MS)
    expect(v.confirmed).toBe(true)
    expect(v.holdProgress).toBe(1)
    expect(v.confirmCount).toBe(1)
  })

  it('progress advances on ticks during silence', () => {
    let { v } = feed(initialView(CFG), [hz(69, 1)], 0)
    v = tick(v, 750)
    expect(v.holdProgress).toBeCloseTo(0.5, 5)
  })

  it('resets when leaving the band', () => {
    let { v, t } = feed(initialView(CFG), Array(20).fill(hz(69, 0)), 0)
    ;({ v, t } = feed(v, Array(10).fill(hz(69, 30)), t))
    expect(v.inTuneSince).toBeNull()
    expect(v.holdProgress).toBe(0)
    expect(v.confirmed).toBe(false)
  })

  it('restarts on note change', () => {
    let { v, t } = feed(initialView(CFG), Array(20).fill(hz(69, 0)), 0)
    ;({ v, t } = feed(v, [hz(71), hz(71)], t))
    expect(v.note?.midi).toBe(71)
    expect(v.inTuneSince).toBe(t - 43 * 2 + 43) // second 71 frame flips the median
    expect(v.confirmed).toBe(false)
  })

  it('restarts on tolerance change and re-confirms with a new count', () => {
    let { v, t } = feed(initialView(CFG), Array(40).fill(hz(69, 4)), 0)
    expect(v.confirmCount).toBe(1)
    const cfg10 = { ...CFG, inTuneCents: 10 }
    ;({ v, t } = feed(v, [hz(69, 4)], t, 43, cfg10))
    expect(v.confirmed).toBe(false)
    expect(v.inTuneSince).toBe(t - 43)
    ;({ v } = feed(v, Array(40).fill(hz(69, 4)), t, 43, cfg10))
    expect(v.confirmCount).toBe(2)
  })

  it('sticky expiry clears hold', () => {
    let { v } = feed(initialView(CFG), [hz(69)], 0)
    v = tick(v, STICKY_HOLD_MS + 1)
    expect(v.inTuneSince).toBeNull()
    expect(v.holdProgress).toBe(0)
  })
})

describe('history', () => {
  it('throttles same note to one entry per HISTORY_THROTTLE_MS', () => {
    const { v } = feed(initialView(CFG), Array(10).fill(hz(69)), 0, 100) // 0..900 ms
    expect(v.history).toHaveLength(2) // t=0 and t=800
  })

  it('adds a new note immediately', () => {
    let { v, t } = feed(initialView(CFG), [hz(69)], 0)
    ;({ v } = feed(v, [hz(64), hz(64)], t))
    expect(v.history.map((h) => h.midi)).toEqual([69, 64]) // 2nd frame: median still 69 (throttled)
  })

  it('caps at HISTORY_MAX', () => {
    const { v } = feed(initialView(CFG), Array(50).fill(hz(69, 3)), 0, HISTORY_THROTTLE_MS)
    expect(v.history).toHaveLength(HISTORY_MAX)
    expect(v.history[0].cents).toBeCloseTo(3, 5)
  })
})

describe('narrative / tone', () => {
  it('narrative boundaries (web copy)', () => {
    expect(narrative(null)).toBe('—')
    expect(narrative(5)).toBe('In tune')
    expect(narrative(-5)).toBe('In tune')
    expect(narrative(12)).toBe('Sharp · ease back')
    expect(narrative(-12)).toBe('Flat · push up')
    expect(narrative(30)).toBe('Sharp — keep loosening')
    expect(narrative(-30)).toBe('Flat — keep tightening')
    expect(narrative(31)).toBe('Very sharp')
    expect(narrative(-31)).toBe('Very flat')
  })

  it('tone uses tol and 3×tol', () => {
    expect(centsTone(5, 5)).toBe('good')
    expect(centsTone(-15, 5)).toBe('warn')
    expect(centsTone(15.1, 5)).toBe('bad')
    expect(centsTone(9, 3)).toBe('warn')
    expect(centsTone(10, 10)).toBe('good')
  })
})
