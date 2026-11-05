import { describe, expect, it } from 'vitest'
import {
  ACCENT_CLICK,
  COUNT_IN_CLICK,
  DEFAULT_METRONOME,
  DOWNBEAT_CLICK,
  SUBDIV_CLICK,
  buildBarLayout,
  handoverBarOffset,
  planHandover,
  renderBar,
  stepAt,
  stepToEvent,
  type MetronomeConfig,
  type Subdivision,
} from './metronomeLayout'

const SR = 48000

function cfg(bpm: number, numerator: number, subdivision: Subdivision = 1): MetronomeConfig {
  return {
    ...DEFAULT_METRONOME,
    bpm,
    numerator,
    beats: { accents: [1], subdivisions: Array<Subdivision>(numerator).fill(subdivision) },
  }
}

describe('buildBarLayout', () => {
  it('lays out one bar on whole samples', () => {
    const l = buildBarLayout(cfg(120, 4), SR)
    expect(l.lengthSamples).toBe(96000)
    expect(l.duration).toBe(2)
    expect(l.beatTimes).toEqual([0, 0.5, 1, 1.5])
    expect(l.steps.map((s) => s.sample)).toEqual([0, 24000, 48000, 72000])
  })

  it('assigns click styles: accent on beat 1, downbeats, subdivisions', () => {
    const l = buildBarLayout(cfg(100, 3, 2), SR)
    expect(l.steps).toHaveLength(6)
    expect(l.steps[0]).toMatchObject({ beat: 1, subdivision: 0, isAccent: true, style: ACCENT_CLICK })
    expect(l.steps[1]).toMatchObject({ beat: 1, subdivision: 1, isAccent: false, isDownbeat: false, style: SUBDIV_CLICK })
    expect(l.steps[2]).toMatchObject({ beat: 2, subdivision: 0, isAccent: false, isDownbeat: true, style: DOWNBEAT_CLICK })
  })

  it('keeps tempo error under one sample per bar for awkward tempos', () => {
    const l = buildBarLayout(cfg(97, 7, 3), 44100)
    const exact = 7 * (60 / 97) * 44100
    expect(Math.abs(l.lengthSamples - exact)).toBeLessThanOrEqual(0.5)
    // triplets evenly spaced within each beat (±1 sample)
    const beat = (60 / 97) * 44100
    expect(Math.abs(l.steps[1].sample - beat / 3)).toBeLessThanOrEqual(1)
    expect(Math.abs(l.steps[2].sample - (2 * beat) / 3)).toBeLessThanOrEqual(1)
  })
})

describe('renderBar', () => {
  it('produces clicks at step positions and silence between', () => {
    const l = buildBarLayout(cfg(120, 4), SR)
    const pcm = renderBar(l)
    expect(pcm.length).toBe(l.lengthSamples)
    const peak = (from: number, to: number) => {
      let m = 0
      for (let i = from; i < to; i++) m = Math.max(m, Math.abs(pcm[i]))
      return m
    }
    expect(peak(0, 2400)).toBeGreaterThan(0.8) // accent ~0.9
    expect(peak(24000, 26400)).toBeGreaterThan(0.5) // downbeat ~0.6
    expect(peak(24000, 26400)).toBeLessThan(0.7)
    expect(peak(4000, 23999)).toBe(0) // silence between clicks
    for (const v of pcm) expect(Math.abs(v)).toBeLessThanOrEqual(1)
  })

  it('wraps a click that overruns the loop end', () => {
    const l = buildBarLayout(cfg(300, 1, 4), SR) // 0.2 s bar, 50 ms steps
    const pcm = renderBar(l)
    expect(pcm.every((v) => Number.isFinite(v))).toBe(true)
  })
})

describe('stepAt', () => {
  const l = buildBarLayout(cfg(120, 4, 2), SR) // steps every 0.25 s
  it('finds the step sounding at a position', () => {
    expect(stepAt(l, 0)).toBe(0)
    expect(stepAt(l, 0.24)).toBe(0)
    expect(stepAt(l, 0.25)).toBe(1)
    expect(stepAt(l, 1.99)).toBe(7)
  })
  it('wraps positions outside the bar', () => {
    expect(stepAt(l, 2.1)).toBe(0)
    expect(stepAt(l, -0.1)).toBe(7)
  })
})

describe('planHandover', () => {
  const old = buildBarLayout(cfg(120, 4), SR) // beats every 0.5 s, bar 2 s

  it('switches at the next beat boundary and keeps the beat index', () => {
    const next = buildBarLayout(cfg(60, 4), SR) // beats every 1 s
    // anchor 10, earliest 13.2 → bar 1, pos 1.2 → next beat index 3 at 13.5
    const h = planHandover(old, 10, 13.2, next)
    expect(h.when).toBeCloseTo(13.5)
    expect(h.offset).toBeCloseTo(3)
    expect(h.anchor).toBeCloseTo(10.5)
  })

  it('starts a new bar when the beat index does not exist in the new meter', () => {
    const next = buildBarLayout(cfg(120, 2), SR)
    const h = planHandover(old, 0, 1.2, next) // next beat index 3 → >= 2 → beat 1
    expect(h.when).toBeCloseTo(1.5)
    expect(h.offset).toBe(0)
    expect(h.anchor).toBeCloseTo(1.5)
  })

  it('rolls over to the next bar after the last beat', () => {
    const h = planHandover(old, 0, 1.7, buildBarLayout(cfg(90, 4), SR))
    expect(h.when).toBeCloseTo(2)
    expect(h.offset).toBe(0)
  })

  it('lands exactly on a boundary', () => {
    const h = planHandover(old, 0, 1, buildBarLayout(cfg(90, 4), SR))
    expect(h.when).toBeCloseTo(1)
    expect(h.offset).toBeCloseTo((2 * 60) / 90)
  })

  it('handles a loop that has not started yet', () => {
    const h = planHandover(old, 5, 4.9, buildBarLayout(cfg(90, 4), SR))
    expect(h.when).toBe(5)
    expect(h.offset).toBe(0)
  })
})

describe('count-in layout', () => {
  it('has one count-in click per beat and the pattern bar length', () => {
    const c: MetronomeConfig = {
      ...cfg(100, 3, 4),
      beats: { accents: [1, 2], subdivisions: [4, 4, 4] },
    }
    const ci = buildBarLayout(c, SR, { countIn: true })
    const pattern = buildBarLayout(c, SR)
    expect(ci.lengthSamples).toBe(pattern.lengthSamples)
    expect(ci.steps).toHaveLength(3)
    expect(ci.steps.every((s) => s.style === COUNT_IN_CLICK && !s.isAccent && s.subdivision === 0)).toBe(true)
    expect(ci.steps.map((s) => s.sample)).toEqual(pattern.beatTimes.map((t) => Math.round(t * SR)))
  })
})

describe('per-beat subdivisions and meters', () => {
  it('lays out mixed subdivisions per beat', () => {
    const c: MetronomeConfig = { ...cfg(60, 4), beats: { accents: [1, 3], subdivisions: [1, 2, 3, 4] } }
    const l = buildBarLayout(c, SR)
    expect(l.steps).toHaveLength(10)
    const beat3 = l.steps.filter((s) => s.beat === 3)
    expect(beat3.map((s) => s.sample)).toEqual([96000, 112000, 128000])
    expect(beat3[0].style).toBe(ACCENT_CLICK)
    expect(beat3[1].style).toBe(SUBDIV_CLICK)
    const beat2 = l.steps.filter((s) => s.beat === 2)
    expect(beat2.map((s) => s.sample)).toEqual([48000, 72000])
    expect(beat2[0].style).toBe(DOWNBEAT_CLICK)
    expect(l.steps.filter((s) => s.beat === 4).map((s) => s.sample)).toEqual([144000, 156000, 168000, 180000])
  })

  it('supports numerator 1 and 12', () => {
    const one = buildBarLayout(cfg(120, 1), SR)
    expect(one.beatTimes).toEqual([0])
    expect(one.lengthSamples).toBe(24000)
    const twelve = buildBarLayout(cfg(220, 12), SR)
    expect(twelve.beatTimes).toHaveLength(12)
    expect(twelve.steps).toHaveLength(12)
    const h = planHandover(twelve, 0, 0.3, one)
    expect(h.offset).toBe(0) // beat index >= 1 → new bar
  })

  it('ignores the denominator (BPM counts denominator notes)', () => {
    const a = buildBarLayout({ ...cfg(130, 7), denominator: 4 }, SR)
    const b = buildBarLayout({ ...cfg(130, 7), denominator: 8 }, SR)
    expect(b).toEqual(a)
  })
})

describe('stepToEvent', () => {
  it('carries phase and run-wide bar number', () => {
    const l = buildBarLayout(cfg(120, 4), SR)
    const e = stepToEvent(l, 10, 1, 2, 'count-in', 3)
    expect(e.phase).toBe('count-in')
    expect(e.barIndex).toBe(5)
    expect(e.time).toBeCloseTo(10 + 2 * 2 + 0.5)
    expect(stepToEvent(l, 0, 0, 0).phase).toBe('pattern')
  })
})

describe('handoverBarOffset', () => {
  const old = buildBarLayout(cfg(120, 4), SR) // bar 2 s

  it('continues the current bar when entering mid-bar', () => {
    const h = planHandover(old, 0, 3.2, buildBarLayout(cfg(60, 4), SR)) // bar 1, beat index 3
    expect(handoverBarOffset(old, 0, 2, h)).toBe(3)
  })

  it('counts the next bar when the new meter restarts at beat 1 mid-bar', () => {
    const h = planHandover(old, 0, 3.2, buildBarLayout(cfg(120, 2), SR))
    expect(h.offset).toBe(0)
    expect(handoverBarOffset(old, 0, 2, h)).toBe(4)
  })

  it('keeps the number at a bar boundary (incl. pending loop after count-in)', () => {
    const roll = planHandover(old, 0, 3.7, buildBarLayout(cfg(90, 4), SR))
    expect(handoverBarOffset(old, 0, 0, roll)).toBe(2)
    const pending = planHandover(old, 5, 4.9, buildBarLayout(cfg(90, 4), SR))
    expect(handoverBarOffset(old, 5, 2, pending)).toBe(2)
  })
})
