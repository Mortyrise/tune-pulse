import { describe, expect, it } from 'vitest'
import type { BeatEvent } from '../audio/metronomeLayout'
import { brandPulseMs, countInLabel, displayedBar, formatElapsed, nextCountIn } from './format'

const evt = (phase: BeatEvent['phase'], barIndex: number): BeatEvent => ({
  time: 0,
  beat: 1,
  subdivision: 0,
  isAccent: false,
  isDownbeat: true,
  phase,
  barIndex,
})

describe('format', () => {
  it('formats elapsed time', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(32_900)).toBe('00:32')
    expect(formatElapsed(61_000)).toBe('01:01')
  })

  it('cycles count-in', () => {
    expect([nextCountIn(0), nextCountIn(1), nextCountIn(2)]).toEqual([1, 2, 0])
    expect(countInLabel(2)).toBe('2 bars')
  })

  it('shows the pattern bar, 0 during count-in or idle', () => {
    expect(displayedBar(null, 0, true)).toBe(0)
    expect(displayedBar(evt('count-in', 1), 2, true)).toBe(0)
    expect(displayedBar(evt('pattern', 2), 2, true)).toBe(1)
    expect(displayedBar(evt('pattern', 11), 0, true)).toBe(12)
    expect(displayedBar(evt('pattern', 11), 0, false)).toBe(0)
  })

  it('syncs the brand dot to two beats while running', () => {
    expect(brandPulseMs(120, true)).toBe(1000)
    expect(brandPulseMs(120, false)).toBe(2000)
  })
})
