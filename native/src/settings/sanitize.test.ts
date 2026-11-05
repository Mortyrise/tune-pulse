import { describe, expect, it } from 'vitest'
import { clampReferenceA4, sanitizeTunerSettings } from './sanitize'
import { DEFAULT_TUNER_SETTINGS } from './types'
import { createMemoryStorage, decodeStored } from './storage'

describe('sanitizeTunerSettings', () => {
  it('returns defaults for non-objects', () => {
    expect(sanitizeTunerSettings(null)).toEqual(DEFAULT_TUNER_SETTINGS)
    expect(sanitizeTunerSettings('x')).toEqual(DEFAULT_TUNER_SETTINGS)
  })

  it('keeps valid fields and replaces invalid ones', () => {
    expect(
      sanitizeTunerSettings({
        notation: 'latin',
        accidental: 'nope',
        referenceA4: 442,
        inTuneCents: 7,
        instrument: 'bass',
      }),
    ).toEqual({ ...DEFAULT_TUNER_SETTINGS, notation: 'latin', referenceA4: 442, instrument: 'bass' })
  })

  it('clamps and rounds A4', () => {
    expect(clampReferenceA4(300)).toBe(400)
    expect(clampReferenceA4(999)).toBe(480)
    expect(clampReferenceA4(441.6)).toBe(442)
    expect(sanitizeTunerSettings({ referenceA4: Number.NaN }).referenceA4).toBe(440)
  })
})

describe('decodeStored', () => {
  it('handles missing, broken and rejected values', () => {
    expect(decodeStored(null)).toBeUndefined()
    expect(decodeStored('{oops')).toBeUndefined()
    expect(decodeStored('"x"', (v) => (v === 'light' ? v : undefined))).toBeUndefined()
    expect(decodeStored('"light"', (v) => (v === 'light' ? v : undefined))).toBe('light')
    expect(decodeStored('{"a":1}')).toEqual({ a: 1 })
  })

  it('memory storage round-trips', async () => {
    const s = createMemoryStorage()
    expect(await s.getItem('k')).toBeNull()
    await s.setItem('k', 'v')
    expect(await s.getItem('k')).toBe('v')
  })
})
