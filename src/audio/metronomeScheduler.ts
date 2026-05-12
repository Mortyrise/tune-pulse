export const SCHEDULE_INTERVAL_MS = 25
export const LOOKAHEAD_MS = 100

export type Subdivision = 1 | 2 | 3 | 4

export type BeatConfig = {
  /** Which beats are accented (1-indexed). [1] = downbeat only. */
  accents: number[]
  /** Subdivision per beat. Length = numerator. */
  subdivisions: Subdivision[]
}

export type MetronomeConfig = {
  bpm: number
  numerator: number
  denominator: number
  beats: BeatConfig
}

export type BeatEvent = {
  time: number
  beat: number
  subdivision: number
  isAccent: boolean
  isDownbeat: boolean
}

export const DEFAULT_METRONOME: MetronomeConfig = {
  bpm: 100,
  numerator: 4,
  denominator: 4,
  beats: {
    accents: [1],
    subdivisions: [1, 1, 1, 1],
  },
}

type ClickStyle = {
  frequency: number
  gain: number
  duration: number
}

const ACCENT_CLICK: ClickStyle = { frequency: 1500, gain: 0.9, duration: 0.05 }
const DOWNBEAT_CLICK: ClickStyle = { frequency: 1000, gain: 0.6, duration: 0.04 }
const SUBDIV_CLICK: ClickStyle = { frequency: 800, gain: 0.3, duration: 0.03 }

export class MetronomeEngine {
  private ctx: AudioContext
  private config: MetronomeConfig
  private nextNoteTime = 0
  private beatIndex = 0
  private subdivIndex = 0
  private timerId: number | null = null
  private onBeat: ((evt: BeatEvent) => void) | null = null
  private scheduledTimeouts: number[] = []

  constructor(ctx: AudioContext, config: MetronomeConfig) {
    this.ctx = ctx
    this.config = config
  }

  setConfig(config: MetronomeConfig) {
    this.config = config
  }

  setOnBeat(cb: ((evt: BeatEvent) => void) | null) {
    this.onBeat = cb
  }

  get running(): boolean {
    return this.timerId !== null
  }

  start() {
    if (this.timerId !== null) return
    this.nextNoteTime = this.ctx.currentTime + 0.05
    this.beatIndex = 0
    this.subdivIndex = 0
    this.tick()
    this.timerId = window.setInterval(() => this.tick(), SCHEDULE_INTERVAL_MS)
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
    for (const id of this.scheduledTimeouts) clearTimeout(id)
    this.scheduledTimeouts = []
  }

  private tick() {
    const horizon = this.ctx.currentTime + LOOKAHEAD_MS / 1000
    while (this.nextNoteTime < horizon) {
      this.scheduleClick(this.nextNoteTime)
      this.advance()
    }
  }

  private scheduleClick(time: number) {
    const beat = this.beatIndex + 1
    const subdiv = this.subdivIndex
    const isDownbeat = subdiv === 0
    const isAccent = isDownbeat && this.config.beats.accents.includes(beat)

    const style = isAccent ? ACCENT_CLICK : isDownbeat ? DOWNBEAT_CLICK : SUBDIV_CLICK

    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = style.frequency
    env.gain.value = 0

    osc.connect(env)
    env.connect(this.ctx.destination)

    env.gain.setValueAtTime(0, time)
    env.gain.linearRampToValueAtTime(style.gain, time + 0.001)
    env.gain.exponentialRampToValueAtTime(0.0001, time + style.duration)

    osc.start(time)
    osc.stop(time + style.duration + 0.01)

    if (this.onBeat) {
      const evt: BeatEvent = { time, beat, subdivision: subdiv, isAccent, isDownbeat }
      const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000)
      const id = window.setTimeout(() => {
        this.scheduledTimeouts = this.scheduledTimeouts.filter((x) => x !== id)
        this.onBeat?.(evt)
      }, delayMs)
      this.scheduledTimeouts.push(id)
    }
  }

  private advance() {
    const subdivCount = this.config.beats.subdivisions[this.beatIndex] ?? 1
    const stepDuration = 60 / this.config.bpm / subdivCount
    this.nextNoteTime += stepDuration

    this.subdivIndex++
    if (this.subdivIndex >= subdivCount) {
      this.subdivIndex = 0
      this.beatIndex = (this.beatIndex + 1) % this.config.numerator
    }
  }
}
