// Pure metronome math (no react-native imports, so vitest runs it in node).
// Types and click styles are ported from the web `src/audio/metronomeScheduler.ts`.

export type Subdivision = 1 | 2 | 3 | 4
export type CountInBars = 0 | 1 | 2
export type Denominator = 2 | 4 | 8 | 16

export type BeatConfig = {
  /** Which beats are accented (1-indexed). [1] = downbeat only. */
  accents: number[]
  /** Subdivision per beat. Length = numerator. */
  subdivisions: Subdivision[]
}

export type MetronomeConfig = {
  bpm: number
  numerator: number
  denominator: Denominator
  beats: BeatConfig
  /** Bars of count-in clicks before the pattern loop (snapshot at start). */
  countInBars: CountInBars
  /** Silent clicks + haptics per step while foregrounded (silent in the background). */
  hapticMode: boolean
}

export type BeatPhase = 'count-in' | 'pattern'

export type BeatEvent = {
  time: number
  beat: number
  subdivision: number
  isAccent: boolean
  isDownbeat: boolean
  phase: BeatPhase
  barIndex: number
}

export const DEFAULT_METRONOME: MetronomeConfig = {
  bpm: 100,
  numerator: 4,
  denominator: 4,
  beats: { accents: [1], subdivisions: [1, 1, 1, 1] },
  countInBars: 0,
  hapticMode: false,
}

export type ClickStyle = { frequency: number; gain: number; duration: number }

export const ACCENT_CLICK: ClickStyle = { frequency: 1500, gain: 0.9, duration: 0.05 }
export const DOWNBEAT_CLICK: ClickStyle = { frequency: 1000, gain: 0.6, duration: 0.04 }
export const SUBDIV_CLICK: ClickStyle = { frequency: 800, gain: 0.3, duration: 0.03 }
export const COUNT_IN_CLICK: ClickStyle = { frequency: 1200, gain: 0.7, duration: 0.04 }

const ATTACK_S = 0.001
const SILENCE_GAIN = 0.0001

export type BarStep = {
  /** Start of the click within the bar, in samples. */
  sample: number
  /** Start of the click within the bar, in seconds (= sample / sampleRate). */
  time: number
  /** 1-indexed beat. */
  beat: number
  /** 0 = on the beat. */
  subdivision: number
  isAccent: boolean
  isDownbeat: boolean
  style: ClickStyle
}

export type BarLayout = {
  sampleRate: number
  bpm: number
  numerator: number
  /** Loop length in whole samples. */
  lengthSamples: number
  /** Loop length in seconds (= lengthSamples / sampleRate, exact). */
  duration: number
  /** Start time (s) of each beat within the bar; length = numerator. */
  beatTimes: number[]
  /** All clicks, sorted by time. */
  steps: BarStep[]
}

/**
 * One bar of clicks laid out on whole-sample positions.
 * `countIn`: one COUNT_IN_CLICK per beat (no subdivisions, no accents), same bar length.
 * The denominator is notation only (BPM counts denominator notes, as on the web): it does
 * not affect the layout.
 */
export function buildBarLayout(
  config: MetronomeConfig,
  sampleRate: number,
  opts: { countIn?: boolean } = {},
): BarLayout {
  const countIn = opts.countIn === true
  const numerator = Math.max(1, Math.round(config.numerator))
  const beatSamples = (60 / config.bpm) * sampleRate
  const lengthSamples = Math.round(numerator * beatSamples)
  const beatTimes: number[] = []
  const steps: BarStep[] = []

  for (let b = 0; b < numerator; b++) {
    const beatStart = b * beatSamples
    beatTimes.push(Math.round(beatStart) / sampleRate)
    const subdivCount = countIn ? 1 : (config.beats.subdivisions[b] ?? 1)
    for (let s = 0; s < subdivCount; s++) {
      const sample = Math.round(beatStart + (s * beatSamples) / subdivCount)
      const isDownbeat = s === 0
      const isAccent = !countIn && isDownbeat && config.beats.accents.includes(b + 1)
      steps.push({
        sample,
        time: sample / sampleRate,
        beat: b + 1,
        subdivision: s,
        isAccent,
        isDownbeat,
        style: countIn ? COUNT_IN_CLICK : isAccent ? ACCENT_CLICK : isDownbeat ? DOWNBEAT_CLICK : SUBDIV_CLICK,
      })
    }
  }

  return {
    sampleRate,
    bpm: config.bpm,
    numerator,
    lengthSamples,
    duration: lengthSamples / sampleRate,
    beatTimes,
    steps,
  }
}

/**
 * Render the bar to mono PCM. Same envelope as the web oscillator clicks:
 * 1 ms linear attack to `gain`, then exponential decay to 0.0001 at `duration`.
 * Clicks that would run past the loop end wrap to the start.
 */
export function renderBar(layout: BarLayout): Float32Array<ArrayBuffer> {
  const { sampleRate, lengthSamples } = layout
  const out = new Float32Array(lengthSamples)
  for (const step of layout.steps) {
    const { frequency, gain, duration } = step.style
    const n = Math.ceil(duration * sampleRate)
    const w = (2 * Math.PI * frequency) / sampleRate
    const decayRatio = SILENCE_GAIN / gain
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate
      const env =
        t < ATTACK_S
          ? (gain * t) / ATTACK_S
          : gain * Math.pow(decayRatio, (t - ATTACK_S) / (duration - ATTACK_S))
      const idx = (step.sample + i) % lengthSamples
      out[idx] += env * Math.sin(w * i)
    }
  }
  for (let i = 0; i < lengthSamples; i++) {
    if (out[i] > 1) out[i] = 1
    else if (out[i] < -1) out[i] = -1
  }
  return out
}

/** Index of the step sounding at `pos` seconds into the bar (pos is wrapped into [0, duration)). */
export function stepAt(layout: BarLayout, pos: number): number {
  const p = ((pos % layout.duration) + layout.duration) % layout.duration
  const steps = layout.steps
  let lo = 0
  let hi = steps.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (steps[mid].time <= p) lo = mid
    else hi = mid - 1
  }
  return lo
}

export type Handover = {
  /** Context time at which the old source stops and the new one starts. */
  when: number
  /** Offset (s) into the new bar buffer to start from. */
  offset: number
  /** Context time of the new loop's (virtual) bar start, for beat derivation. */
  anchor: number
}

/**
 * Plan a sample-accurate swap from the running loop (`oldLayout`, bar started at
 * `anchor`) to `newLayout` at the first beat boundary at or after `earliest`.
 * The new source enters at the same beat index (or beat 1 if the new bar is shorter).
 */
export function planHandover(
  oldLayout: BarLayout,
  anchor: number,
  earliest: number,
  newLayout: BarLayout,
): Handover {
  let when: number
  let beatIndex: number
  const elapsed = earliest - anchor
  if (elapsed <= 0) {
    when = anchor
    beatIndex = 0
  } else {
    const barIdx = Math.floor(elapsed / oldLayout.duration)
    const pos = elapsed - barIdx * oldLayout.duration
    const k = oldLayout.beatTimes.findIndex((t) => t >= pos)
    if (k === -1) {
      when = anchor + (barIdx + 1) * oldLayout.duration
      beatIndex = 0
    } else {
      when = anchor + barIdx * oldLayout.duration + oldLayout.beatTimes[k]
      beatIndex = k
    }
  }
  if (beatIndex >= newLayout.numerator) beatIndex = 0
  const offset = newLayout.beatTimes[beatIndex]
  return { when, offset, anchor: when - offset }
}

/**
 * Bar number (run-wide, count-in bars included) of the new segment's first bar after a
 * handover from `base` (bar 0 of base = `baseBarOffset`). Keeps BAR counting across config
 * changes: entering mid-bar continues the current bar; entering a new bar at beat 1 when the
 * old bar was not finished starts the next number.
 */
export function handoverBarOffset(
  baseLayout: BarLayout,
  baseAnchor: number,
  baseBarOffset: number,
  plan: Handover,
): number {
  const EPS = 1e-9
  const elapsed = Math.max(0, plan.when - baseAnchor)
  const bar = Math.floor(elapsed / baseLayout.duration + EPS)
  const posInBar = elapsed - bar * baseLayout.duration
  const atBarStart = Math.abs(posInBar) < 1e-7
  if (plan.offset > EPS || atBarStart) return baseBarOffset + bar
  return baseBarOffset + bar + 1
}

export function stepToEvent(
  layout: BarLayout,
  anchor: number,
  index: number,
  barIndex: number,
  phase: BeatPhase = 'pattern',
  barOffset = 0,
): BeatEvent {
  const s = layout.steps[index]
  return {
    time: anchor + barIndex * layout.duration + s.time,
    beat: s.beat,
    subdivision: s.subdivision,
    isAccent: s.isAccent,
    isDownbeat: s.isDownbeat,
    phase,
    barIndex: barOffset + barIndex,
  }
}
