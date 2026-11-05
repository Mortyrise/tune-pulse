// Pure tuner display logic, ported from the web TunerScreen (useStickySample,
// hold-to-confirm, history strip, narrative, colour thresholds) plus light
// smoothing for the native ~23 analyses/s rate. No React, no RN: vitest-able.

/** Keep the last valid note visible this long through silence / rejected frames. */
export const STICKY_HOLD_MS = 1500
/** Time inside ±tolerance before the "in tune" state is confirmed. */
export const CONFIRM_HOLD_MS = 1500
export const HISTORY_MAX = 12
/** Same note is added to the history at most once per this interval. */
export const HISTORY_THROTTLE_MS = 800
/** Median window (accepted analyses) — rejects single-frame octave/harmonic glitches. */
export const MEDIAN_N = 3
/** EMA weight of the newest median for the displayed cents. */
export const EMA_ALPHA = 0.5

export type ViewConfig = { referenceA4: number; inTuneCents: number }

export type ViewSample = { frequency: number; clarity: number; rms: number }

export type ViewEvent =
  | { type: 'sample'; sample: ViewSample; at: number }
  | { type: 'tick'; at: number }

export type DisplayNote = {
  midi: number
  /** Smoothed cents relative to `midi`, clamped to ±50. */
  cents: number
  /** Last accepted raw frequency (Hz). */
  frequency: number
  clarity: number
}

export type HistoryEntry = { cents: number; midi: number }

export type TunerView = {
  cfg: ViewConfig
  note: DisplayNote | null
  lastAcceptedAt: number
  /** Last MEDIAN_N accepted midiFloats. */
  medianBuf: number[]
  /** EMA of the median, in midiFloat. */
  ema: number | null
  inTuneSince: number | null
  holdProgress: number
  confirmed: boolean
  /** Increments on every false -> true transition of `confirmed`. */
  confirmCount: number
  history: HistoryEntry[]
  historyLastAt: number
  historyLastMidi: number | null
}

export function initialView(cfg: ViewConfig): TunerView {
  return {
    cfg,
    note: null,
    lastAcceptedAt: 0,
    medianBuf: [],
    ema: null,
    inTuneSince: null,
    holdProgress: 0,
    confirmed: false,
    confirmCount: 0,
    history: [],
    historyLastAt: 0,
    historyLastMidi: null,
  }
}

export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Median that always returns one of the inputs. With an even count (buffer
 * still filling) it takes the middle value closest to `prev`, so a jump
 * between two notes never produces a phantom note halfway between them.
 */
export function robustMedian(values: readonly number[], prev: number | null): number {
  if (values.length % 2) return median(values)
  const s = [...values].sort((a, b) => a - b)
  const lo = s[s.length / 2 - 1]
  const hi = s[s.length / 2]
  if (prev === null) return values[values.length - 1]
  return Math.abs(lo - prev) <= Math.abs(hi - prev) ? lo : hi
}

function frequencyToMidiFloat(frequency: number, referenceA4: number): number {
  return 12 * Math.log2(frequency / referenceA4) + 69
}

const clampCents = (c: number) => Math.max(-50, Math.min(50, c))

function clearNote(s: TunerView): TunerView {
  return { ...s, note: null, medianBuf: [], ema: null, inTuneSince: null, holdProgress: 0, confirmed: false }
}

/** Recompute hold state for the current note at time `at`. */
function applyHold(s: TunerView, at: number, noteChanged: boolean): TunerView {
  const inBand = s.note !== null && Math.abs(s.note.cents) <= s.cfg.inTuneCents
  let inTuneSince = s.inTuneSince
  if (!inBand) inTuneSince = null
  else if (inTuneSince === null || noteChanged) inTuneSince = at
  const holdProgress = inTuneSince === null ? 0 : Math.min(1, (at - inTuneSince) / CONFIRM_HOLD_MS)
  const confirmed = holdProgress >= 1
  const confirmCount = confirmed && !s.confirmed ? s.confirmCount + 1 : s.confirmCount
  if (
    inTuneSince === s.inTuneSince &&
    holdProgress === s.holdProgress &&
    confirmed === s.confirmed
  ) {
    return s
  }
  return { ...s, inTuneSince, holdProgress, confirmed, confirmCount }
}

/**
 * Fold one event into the view. Returns the same object when nothing visible
 * changed, so callers can skip re-renders with a reference check.
 */
export function reduceView(state: TunerView, event: ViewEvent, cfg: ViewConfig): TunerView {
  let s = state
  const at = event.at

  // Config changes: a new A4 invalidates the note and smoothing; a new
  // tolerance restarts the hold timer.
  if (cfg.referenceA4 !== s.cfg.referenceA4) {
    s = { ...clearNote(s), cfg }
  } else if (cfg.inTuneCents !== s.cfg.inTuneCents) {
    s = { ...s, cfg, inTuneSince: null, holdProgress: 0, confirmed: false }
  }

  let noteChanged = false

  if (event.type === 'sample') {
    const { frequency, clarity } = event.sample
    if (Number.isFinite(frequency) && frequency > 0) {
      const m = frequencyToMidiFloat(frequency, s.cfg.referenceA4)
      const medianBuf = [...s.medianBuf, m].slice(-MEDIAN_N)
      const med = robustMedian(medianBuf, s.ema)
      const midi = Math.round(med)
      noteChanged = s.note === null || s.note.midi !== midi
      const ema = noteChanged || s.ema === null ? med : s.ema + EMA_ALPHA * (med - s.ema)
      const note: DisplayNote = { midi, cents: clampCents((ema - midi) * 100), frequency, clarity }

      let { history, historyLastAt, historyLastMidi } = s
      const sameNote = historyLastMidi === midi
      if (!sameNote || at - historyLastAt >= HISTORY_THROTTLE_MS) {
        history = [...history.slice(-(HISTORY_MAX - 1)), { cents: clampCents((med - midi) * 100), midi }]
        historyLastAt = at
        historyLastMidi = midi
      }
      s = { ...s, note, medianBuf, ema, lastAcceptedAt: at, history, historyLastAt, historyLastMidi }
    }
  }

  // Sticky expiry (checked on every event, accepted or not).
  if (s.note !== null && at - s.lastAcceptedAt >= STICKY_HOLD_MS) {
    s = clearNote(s)
  }

  return applyHold(s, at, noteChanged)
}

// --- presentation helpers (web parity) ---------------------------------------

export function narrative(cents: number | null): string {
  if (cents === null) return '—'
  const abs = Math.abs(cents)
  if (abs <= 5) return 'In tune'
  if (abs <= 12) return cents > 0 ? 'Sharp · ease back' : 'Flat · push up'
  if (abs <= 30) return cents > 0 ? 'Sharp — keep loosening' : 'Flat — keep tightening'
  return cents > 0 ? 'Very sharp' : 'Very flat'
}

export type Tone = 'good' | 'warn' | 'bad'

/** Web thresholds: good ≤ tol, warn ≤ 3×tol, bad beyond. */
export function centsTone(cents: number, inTuneCents: number): Tone {
  const abs = Math.abs(cents)
  if (abs <= inTuneCents) return 'good'
  if (abs <= inTuneCents * 3) return 'warn'
  return 'bad'
}

/** Theme colour for a tone (`colors` = `useTheme().colors`). */
export function toneColor(tone: Tone, colors: Record<Tone, string>): string {
  return colors[tone]
}

export function formatCents(cents: number): string {
  return `${cents >= 0 ? '+' : ''}${cents.toFixed(1)}`
}
