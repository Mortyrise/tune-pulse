// Native metronome engine: one pre-rendered bar looped by an AudioBufferSourceNode.
// Once started, the clicks come from the native audio thread, so JS timer
// throttling (background / screen locked) cannot drop clicks.
// Config changes swap in a new source at the next beat boundary (sample-exact).
import type { AudioBufferSourceNode, AudioContext, GainNode } from 'react-native-audio-api'
import {
  buildBarLayout,
  planHandover,
  renderBar,
  stepAt,
  stepToEvent,
  type BarLayout,
  type BeatEvent,
  type MetronomeConfig,
} from './metronomeLayout'

export * from './metronomeLayout'

export const ENGINE_MODE = 'loop-buffer'

/** Lead time for the first click and for handovers. */
const START_LEAD_S = 0.05
const HANDOVER_LEAD_S = 0.03
/** Collapse bursts of config changes (e.g. repeated +1 taps) into one rebuild. */
const CONFIG_DEBOUNCE_MS = 120
const UI_POLL_MS = 16

type Segment = { layout: BarLayout; anchor: number; source: AudioBufferSourceNode; startsAt: number }

function layoutKey(c: MetronomeConfig): string {
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
    const layout = buildBarLayout(config, this.ctx.sampleRate)
    const source = this.createSource(layout)
    const when = this.ctx.currentTime + START_LEAD_S
    source.start(when)
    this.segments = [{ layout, anchor: when, source, startsAt: when }]
    this.lastStepKey = ''
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
    this.segments.push({ layout, anchor: plan.anchor, source, startsAt: plan.when })
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
    this.onBeat(stepToEvent(seg.layout, seg.anchor, index, barIndex))
  }
}
