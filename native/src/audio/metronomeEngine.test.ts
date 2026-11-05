import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioContext } from 'react-native-audio-api'
import { DEFAULT_METRONOME, MetronomeEngine, type BeatEvent, type MetronomeConfig } from './metronome'

// Minimal fake of the react-native-audio-api surface the engine uses.
type Call = [string, ...number[]]

class FakeSource {
  buffer: { duration: number } | null = null
  loop = false
  loopStart = 0
  loopEnd = 0
  onended: (() => void) | null = null
  calls: Call[] = []
  start(when = 0, offset = 0) {
    this.calls.push(['start', when, offset])
  }
  stop(when = 0) {
    this.calls.push(['stop', when])
  }
  connect() {}
  disconnect() {}
}

class FakeParam {
  value = 1
  calls: Call[] = []
  setValueAtTime(v: number, t: number) {
    this.calls.push(['set', v, t])
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(['ramp', v, t])
  }
  cancelScheduledValues(t: number) {
    this.calls.push(['cancel', t])
  }
}

function fakeContext() {
  const sources: FakeSource[] = []
  const gain = new FakeParam()
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    createGain: () => ({ gain, connect() {}, disconnect() {} }),
    createBuffer: (_ch: number, length: number, sr: number) => ({ duration: length / sr, copyToChannel() {} }),
    createBufferSource: () => {
      const s = new FakeSource()
      sources.push(s)
      return s
    },
  }
  return { ctx, sources, gain, engine: new MetronomeEngine(ctx as unknown as AudioContext) }
}

const cfg = (patch: Partial<MetronomeConfig> = {}): MetronomeConfig => ({ ...DEFAULT_METRONOME, bpm: 120, ...patch })

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('MetronomeEngine', () => {
  it('starts only the pattern loop without count-in', () => {
    const { engine, sources } = fakeContext()
    engine.start(cfg())
    expect(sources).toHaveLength(1)
    expect(sources[0].loop).toBe(true)
    expect(sources[0].calls).toEqual([['start', 0.05, 0]])
  })

  it('schedules the count-in loop and hands over to the pattern sample-exactly', () => {
    const { engine, sources } = fakeContext()
    engine.start(cfg({ countInBars: 2 })) // bar = 2 s at 120 BPM 4/4
    expect(sources).toHaveLength(2)
    const [countIn, pattern] = sources
    expect(countIn.calls[0]).toEqual(['start', 0.05, 0])
    expect(countIn.calls[1][0]).toBe('stop')
    expect(countIn.calls[1][1]).toBeCloseTo(4.05)
    expect(pattern.calls[0][0]).toBe('start')
    expect(pattern.calls[0][1]).toBe(countIn.calls[1][1])
  })

  it('stops both sources when stopped during the count-in', () => {
    const { engine, sources } = fakeContext()
    engine.start(cfg({ countInBars: 1 }))
    engine.stop()
    expect(engine.running).toBe(false)
    for (const s of sources) expect(s.calls.at(-1)?.[0]).toBe('stop')
  })

  it('swaps the pending pattern at the count-in end when the config changes', () => {
    const { engine, ctx, sources } = fakeContext()
    engine.start(cfg({ countInBars: 1 }))
    ctx.currentTime = 0.5
    engine.setConfig(cfg({ countInBars: 1, bpm: 60 }))
    vi.advanceTimersByTime(200)
    expect(sources).toHaveLength(3)
    const patternStart = sources[1].calls[0][1]
    expect(sources[1].calls[1]).toEqual(['stop', patternStart])
    expect(sources[2].calls[0]).toEqual(['start', patternStart, 0])
  })

  it('does not rebuild for denominator, count-in or haptic changes', () => {
    const { engine, sources, gain } = fakeContext()
    engine.start(cfg())
    engine.setConfig(cfg({ denominator: 8, countInBars: 2, hapticMode: true }))
    engine.setMuted(true)
    vi.advanceTimersByTime(200)
    expect(sources).toHaveLength(1)
    expect(gain.calls.at(-1)?.slice(0, 2)).toEqual(['ramp', 0])
  })

  it('mutes immediately when not running', () => {
    const { engine, gain } = fakeContext()
    engine.setMuted(true)
    expect(gain.value).toBe(0)
    engine.setMuted(false)
    expect(gain.value).toBe(1)
  })

  it('polls count-in events, then pattern events with run-wide bar numbers', () => {
    const { engine, ctx } = fakeContext()
    const events: BeatEvent[] = []
    engine.setOnBeat((e) => events.push(e))
    engine.start(cfg({ countInBars: 1 }))
    engine.setUiActive(true)
    ctx.currentTime = 0.06 // count-in beat 1
    vi.advanceTimersByTime(20)
    ctx.currentTime = 2.06 // pattern beat 1
    vi.advanceTimersByTime(20)
    ctx.currentTime = 4.56 // pattern bar 2, beat 2
    vi.advanceTimersByTime(20)
    engine.setUiActive(false)
    expect(events.map((e) => [e.phase, e.barIndex, e.beat])).toEqual([
      ['count-in', 0, 1],
      ['pattern', 1, 1],
      ['pattern', 2, 2],
    ])
  })
})
