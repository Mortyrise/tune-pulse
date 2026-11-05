// Native metronome engine: one pre-rendered bar looped by an AudioBufferSourceNode.
// Once started, the clicks come from the native audio thread, so JS timer
// throttling (background / screen locked) cannot drop clicks.
// Config changes swap in a new source at the next beat boundary (sample-exact).
// Count-in: a second looped source (count-in bar) scheduled at start and stopped exactly
// where the pattern loop starts, so it needs no JS after start() either.
// Haptic mode mutes the output gain; the loop keeps running (timing/handover unchanged).
import type { AudioBufferSourceNode, AudioContext, GainNode } from 'react-native-audio-api'
import {
  buildBarLayout,
  handoverBarOffset,
  planHandover,
  renderBar,
  stepAt,
  stepToEvent,
  type BarLayout,
  type BeatEvent,
  type BeatPhase,
  type MetronomeConfig,
} from './metronomeLayout'

export * from './metronomeLayout'
export * from './metronomeConfig'

export const ENGINE_MODE = 'loop-buffer'

/** Lead time for the first click and for handovers. */
const START_LEAD_S = 0.05
const HANDOVER_LEAD_S = 0.03
/** Collapse bursts of config changes (e.g. repeated +1 taps) into one rebuild. */
const CONFIG_DEBOUNCE_MS = 120
const UI_POLL_MS = 16
/** Delay + ramp for mute changes (avoids a pop). */
const MUTE_LEAD_S = 0.01
const MUTE_RAMP_S = 0.005

type Segment = {
  layout: BarLayout
  anchor: number
  source: AudioBufferSourceNode
  startsAt: number
  phase: BeatPhase
  /** Run-wide bar number of this segment's bar 0 (count-in bars included, like the web). */
  barOffset: number
}

/** Fields that change the rendered bar. Denominator, count-in and haptic mode don't. */
export function layoutKey(c: MetronomeConfig): string {
  return `${c.bpm}|${c.numerator}|${c.beats.subdivisions.join(',')}|${c.beats.accents.join(',')}`
}

export class MetronomeEngine {
  private readonly ctx: AudioContext
  private readonly out: GainNode
  private config: MetronomeConfig | null = null
  private appliedKey = ''
  /**
   * Scheduled loops sorted by `startsAt`. segments[0] is the one sounding now; each later one
   * takes over at its `startsAt` (its predecessor's source is stopped at that same time).
   */
  private segments: Segment[] = []
  private debounceId: ReturnType<typeof setTimeout> | null = null
  private pollId: ReturnType<typeof setInterval> | null = null
  private onBeat: ((evt: BeatEvent) => void) | null = null
  private lastStepKey = ''
  private muted = false

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 1
    this.out.connect(ctx.destination)
  }

  get running(): boolean {
    return this.segments.length > 0
  }

  start(config: MetronomeConfig) {
    if (this.segments.length > 0) return
    this.config = config
    this.appliedKey = layoutKey(config)
    const sr = this.ctx.sampleRate
    const t0 = this.ctx.currentTime + START_LEAD_S
    const segments: Segment[] = []
    let patternAt = t0
    const bars = config.countInBars
    if (bars > 0) {
      const ciLayout = buildBarLayout(config, sr, { countIn: true })
      const ciSource = this.createSource(ciLayout)
      patternAt = t0 + bars * ciLayout.duration
      ciSource.start(t0)
      ciSource.stop(patternAt)
      segments.push({ layout: ciLayout, anchor: t0, source: ciSource, startsAt: t0, phase: 'count-in', barOffset: 0 })
    }
    const layout = buildBarLayout(config, sr)
    const source = this.createSource(layout)
    source.start(patternAt)
    segments.push({ layout, anchor: patternAt, source, startsAt: patternAt, phase: 'pattern', barOffset: bars })
    this.segments = segments
    this.lastStepKey = ''
  }

  /** Haptic mode: silence the clicks without touching the loop. */
  setMuted(muted: boolean) {
    if (muted === this.muted) return
    this.muted = muted
    const gain = this.out.gain
    const target = muted ? 0 : 1
    if (this.segments.length === 0) {
      gain.cancelScheduledValues(0)
      gain.value = target
      return
    }
    const t = this.ctx.currentTime + MUTE_LEAD_S
    gain.cancelScheduledValues(0)
    gain.setValueAtTime(muted ? 1 : 0, t)
    gain.linearRampToValueAtTime(target, t + MUTE_RAMP_S)
  }

  get isMuted(): boolean {
    return this.muted
  }

  stop() {
    if (this.debounceId !== null) {
      clearTimeout(this.debounceId)
      this.debounceId = null
    }
    for (const seg of this.segments) {
      seg.source.onended = null
      try {
        seg.source.stop()
      } catch {
        // already stopped
      }
      try {
        seg.source.disconnect()
      } catch {
        // already disconnected
      }
    }
    this.segments = []
    this.lastStepKey = ''
  }

  setConfig(config: MetronomeConfig) {
    this.config = config
    if (this.segments.length === 0) return
    if (this.debounceId !== null) clearTimeout(this.debounceId)
    this.debounceId = setTimeout(() => {
      this.debounceId = null
      this.applyConfig()
    }, CONFIG_DEBOUNCE_MS)
  }

  setOnBeat(cb: ((evt: BeatEvent) => void) | null) {
    this.onBeat = cb
  }

  /** Poll currentTime for UI beat events. Only enable while the app is foregrounded. */
  setUiActive(active: boolean) {
    if (active && this.pollId === null) {
      this.pollId = setInterval(() => this.poll(), UI_POLL_MS)
    } else if (!active && this.pollId !== null) {
      clearInterval(this.pollId)
      this.pollId = null
      this.lastStepKey = ''
    }
  }

  dispose() {
    this.setUiActive(false)
    this.stop()
    this.out.disconnect()
  }

  private createSource(layout: BarLayout): AudioBufferSourceNode {
    const pcm = renderBar(layout)
    const buffer = this.ctx.createBuffer(1, layout.lengthSamples, layout.sampleRate)
    buffer.copyToChannel(pcm, 0)
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.loopStart = 0
    source.loopEnd = buffer.duration
    source.connect(this.out)
    return source
  }

  /** Drop segments that a later segment has already replaced; returns the one sounding now. */
  private currentSegment(now: number): Segment | undefined {
    while (this.segments.length > 1 && now >= this.segments[1].startsAt) {
      this.segments.shift()
    }
    return this.segments[0]
  }

  private applyConfig() {
    const config = this.config
    if (!config || this.segments.length === 0) return
    const key = layoutKey(config)
    if (key === this.appliedKey) return

    const now = this.ctx.currentTime
    this.currentSegment(now)
    const base = this.segments[this.segments.length - 1]
    const layout = buildBarLayout(config, this.ctx.sampleRate)
    const plan = planHandover(base.layout, base.anchor, Math.max(now + HANDOVER_LEAD_S, base.startsAt), layout)

    const barOffset = handoverBarOffset(base.layout, base.anchor, base.barOffset, plan)
    const source = this.createSource(layout)
    source.start(plan.when, plan.offset)
    const old = base.source
    old.stop(plan.when)
    old.onended = () => {
      try {
        old.disconnect()
      } catch {
        // already disconnected by stop()
      }
    }

    // plan.when >= base.startsAt, so a base that has not started yet still plays from its
    // startsAt until plan.when, exactly as the segment list says.
    this.segments.push({ layout, anchor: plan.anchor, source, startsAt: plan.when, phase: 'pattern', barOffset })
    this.appliedKey = key
  }

  private poll() {
    if (!this.onBeat) return
    const now = this.ctx.currentTime
    const seg = this.currentSegment(now)
    if (!seg) return
    const elapsed = now - seg.anchor
    if (now < seg.startsAt || elapsed < 0) return
    const barIndex = Math.floor(elapsed / seg.layout.duration)
    const index = stepAt(seg.layout, elapsed - barIndex * seg.layout.duration)
    const stepKey = `${seg.startsAt}|${barIndex}|${index}`
    if (stepKey === this.lastStepKey) return
    this.lastStepKey = stepKey
    this.onBeat(stepToEvent(seg.layout, seg.anchor, index, barIndex, seg.phase, seg.barOffset))
  }
}
