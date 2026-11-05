import { describe, expect, it } from 'vitest'
import { INSTRUMENTS, findClosestString, getInstrument } from './instruments'

describe('instruments', () => {
  it('has the expected tunings', () => {
    expect(getInstrument('guitar').strings!.map((s) => s.midi)).toEqual([40, 45, 50, 55, 59, 64])
    expect(getInstrument('bass').strings!.map((s) => s.midi)).toEqual([28, 33, 38, 43])
    expect(getInstrument('ukulele').strings!.map((s) => s.midi)).toEqual([67, 60, 64, 69])
    expect(getInstrument('violin').strings!.map((s) => s.midi)).toEqual([55, 62, 69, 76])
    expect(getInstrument('chromatic').strings).toBeNull()
    expect(INSTRUMENTS).toHaveLength(5)
  })

  it('falls back to chromatic for unknown ids', () => {
    expect(getInstrument('nope' as never).id).toBe('chromatic')
  })
})

describe('findClosestString', () => {
  const guitar = getInstrument('guitar').strings!

  it('returns null for no strings', () => {
    expect(findClosestString(60, [])).toBeNull()
  })

  it('matches exact strings', () => {
    expect(findClosestString(40, guitar)).toMatchObject({ index: 0, semitoneDelta: 0 })
    expect(findClosestString(64, guitar)).toMatchObject({ index: 5, semitoneDelta: 0 })
  })

  it('reports semitone delta', () => {
    expect(findClosestString(41, guitar)).toMatchObject({ index: 0, semitoneDelta: 1 })
    expect(findClosestString(30, guitar)).toMatchObject({ index: 0, semitoneDelta: -10 })
  })

  it('first string wins on ties', () => {
    // 57 is 2 from both G3 (55) and B3 (59)
    expect(findClosestString(57, guitar)).toMatchObject({ index: 3, semitoneDelta: 2 })
  })

  it('handles re-entrant ukulele order', () => {
    const uke = getInstrument('ukulele').strings!
    expect(findClosestString(60, uke)).toMatchObject({ index: 1 }) // C4
    expect(findClosestString(68, uke)).toMatchObject({ index: 0, semitoneDelta: 1 }) // G#4 -> G4 (tie with A4, first wins)
  })
})
