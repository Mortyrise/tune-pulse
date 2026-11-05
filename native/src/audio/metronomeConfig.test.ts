import { describe, expect, it } from 'vitest'
import { DEFAULT_METRONOME } from './metronomeLayout'
import { clampBpm, nextSubdivision, sanitizeConfig } from './metronomeConfig'

describe('sanitizeConfig', () => {
  it('returns the default for garbage', () => {
    expect(sanitizeConfig(null)).toEqual(DEFAULT_METRONOME)
    expect(sanitizeConfig('x')).toEqual(DEFAULT_METRONOME)
    expect(sanitizeConfig([1, 2])).toEqual(DEFAULT_METRONOME)
  })

  it('keeps a valid config intact', () => {
    const c = {
      bpm: 220,
      numerator: 12,
      denominator: 8,
      beats: { accents: [1, 4, 7, 9, 11], subdivisions: Array(12).fill(1) },
      countInBars: 2,
      hapticMode: true,
    }
    expect(sanitizeConfig(c)).toEqual(c)
  })

  it('clamps and repairs out-of-range fields', () => {
    const c = sanitizeConfig({
      bpm: 999,
      numerator: 20,
      denominator: 3,
      beats: { accents: [0, 3, 3, 13, 'a'], subdivisions: [2, 7, 4] },
      countInBars: 5,
      hapticMode: 'yes',
    })
    expect(c.bpm).toBe(300)
    expect(c.numerator).toBe(12)
    expect(c.denominator).toBe(4)
    expect(c.beats.accents).toEqual([3])
    expect(c.beats.subdivisions).toHaveLength(12)
    expect(c.beats.subdivisions.slice(0, 4)).toEqual([2, 1, 4, 1])
    expect(c.countInBars).toBe(0)
    expect(c.hapticMode).toBe(false)
  })

  it('trims subdivisions and accents to a smaller numerator', () => {
    const c = sanitizeConfig({ numerator: 2, beats: { accents: [1, 3], subdivisions: [3, 3, 3, 3] } })
    expect(c.beats).toEqual({ accents: [1], subdivisions: [3, 3] })
  })
})

describe('helpers', () => {
  it('clamps bpm and cycles subdivisions', () => {
    expect(clampBpm(12)).toBe(30)
    expect(clampBpm(120.6)).toBe(121)
    expect(clampBpm(Number.NaN)).toBe(DEFAULT_METRONOME.bpm)
    expect([1, 2, 3, 4].map((s) => nextSubdivision(s as 1 | 2 | 3 | 4))).toEqual([2, 3, 4, 1])
  })
})
