import { describe, expect, it } from 'vitest'
import { getTempoCharacter, registerTap } from './tempo'

describe('getTempoCharacter', () => {
  it('maps boundaries per the handoff table', () => {
    expect(getTempoCharacter(40).name).toBe('Grave')
    expect(getTempoCharacter(41).name).toBe('Largo')
    expect(getTempoCharacter(108).name).toBe('Andante')
    expect(getTempoCharacter(109).name).toBe('Moderato')
    expect(getTempoCharacter(300).name).toBe('Prestissimo')
  })
})

describe('registerTap', () => {
  it('needs two taps, then averages over a window of 4', () => {
    const taps: number[] = []
    expect(registerTap(taps, 0)).toBeNull()
    expect(registerTap(taps, 500)).toBe(120)
    expect(registerTap(taps, 1000)).toBe(120)
    expect(registerTap(taps, 1700)).toBe(106) // mean 567 ms
    expect(registerTap(taps, 2000)).toBe(120) // window 500..2000, mean 500
    expect(taps).toHaveLength(4)
  })

  it('resets after a gap of more than 2 s', () => {
    const taps = [0, 500]
    expect(registerTap(taps, 3000)).toBeNull()
    expect(taps).toEqual([3000])
    expect(registerTap(taps, 3600)).toBe(100)
  })
})
