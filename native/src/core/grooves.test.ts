import { describe, expect, it } from 'vitest'
import { DEFAULT_METRONOME } from '../audio/metronomeLayout'
import { sanitizeConfig } from '../audio/metronomeConfig'
import { GROOVES_LIBRARY, grooveToConfig } from './grooves'

describe('GROOVES_LIBRARY', () => {
  it('has the 12 curated presets', () => {
    expect(GROOVES_LIBRARY).toHaveLength(12)
    expect(new Set(GROOVES_LIBRARY.map((g) => g.id)).size).toBe(12)
  })

  it.each(GROOVES_LIBRARY)('$name is a valid config', (g) => {
    const c = grooveToConfig(g, DEFAULT_METRONOME)
    expect(g.subdivisions).toHaveLength(g.numerator)
    expect(g.accents.every((a) => a >= 1 && a <= g.numerator)).toBe(true)
    expect(sanitizeConfig(c)).toEqual(c)
  })

  it('keeps count-in and haptic mode from the base config', () => {
    const base = { ...DEFAULT_METRONOME, countInBars: 2 as const, hapticMode: true }
    const c = grooveToConfig(GROOVES_LIBRARY[1], base)
    expect(c.countInBars).toBe(2)
    expect(c.hapticMode).toBe(true)
    expect(c.bpm).toBe(96)
    expect(c.beats.accents).toEqual([2, 4])
  })
})
