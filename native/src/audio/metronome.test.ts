import { describe, expect, it } from 'vitest'
import {
  ACCENT_CLICK,
  DEFAULT_METRONOME,
  DOWNBEAT_CLICK,
  SUBDIV_CLICK,
  buildBarLayout,
  planHandover,
  renderBar,
  stepAt,
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
