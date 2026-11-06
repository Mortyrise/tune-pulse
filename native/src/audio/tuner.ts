// Mic capture -> MPM pitch detection, on the JS thread.
//
// react-native-audio-api@1.0.0 `AudioRecorder.onAudioReady` delivers, on the JS
// thread, a fresh mono AudioBuffer of exactly `bufferLength` frames, resampled
// natively to the requested `sampleRate`. We feed each chunk to MpmDetector with
// hopSize = bufferLength, so there is one analysis per callback.
//
// Every preset goes through the same MpmDetector; they differ in rate/window
// and in whether the 5 kHz input low-pass is on (see 06-tuner-detection.md).
import { AudioManager, AudioRecorder } from 'react-native-audio-api'
import { DEFAULT_MPM_OPTIONS, MpmDetector, type MpmDebug, type PitchSample } from '../core/mpm'
import { configureAudioSession, requestMicPermission } from './session'

export type { MpmDebug, MpmRejectReason } from '../core/mpm'

export type TunerPreset = 'full' | 'light' | 'raw'

export type TunerPresetInfo = { id: TunerPreset; label: string; description: string }

/** Presets in display order; `full` is the default. */
export const TUNER_PRESETS: readonly TunerPresetInfo[] = [
  { id: 'full', label: 'Full', description: 'Device rate, 5 kHz low-pass (default)' },
  { id: 'light', label: 'Light', description: '24 kHz, 5 kHz low-pass (CPU fallback)' },
  { id: 'raw', label: 'Raw', description: 'Old pipeline: no low-pass, gate 0.01 (A/B test)' },
]

export const DEFAULT_TUNER_PRESET: TunerPreset = 'full'

type PresetConfig = {
  /** null = device preferred rate (no resampling). */
  sampleRate: number | null
  /** MPM analysis window (samples). */
  windowSize: number
  /** Frames per recorder callback (= MPM hop). ~23 callbacks/s either way. */
  bufferLength: number
  /** Input low-pass cutoff (Hz), 0 = off. */
  lowpassHz: number
  rmsThreshold: number
}

const FILTER_HZ = DEFAULT_MPM_OPTIONS.lowpassHz
const GATE = DEFAULT_MPM_OPTIONS.rmsThreshold

const PRESETS: Record<TunerPreset, PresetConfig> = {
  full: { sampleRate: null, windowSize: 4096, bufferLength: 2048, lowpassHz: FILTER_HZ, rmsThreshold: GATE },
  light: { sampleRate: 24000, windowSize: 2048, bufferLength: 1024, lowpassHz: FILTER_HZ, rmsThreshold: GATE },
  // Pre-06 behaviour (except the τ-scan fix, which has no switch).
  raw: { sampleRate: null, windowSize: 4096, bufferLength: 2048, lowpassHz: 0, rmsThreshold: 0.01 },
}

const FALLBACK_SAMPLE_RATE = 48000

export type TunerInfo = {
  preset: TunerPreset
  /** Rate requested from the recorder (and the rate of the delivered data). */
  sampleRate: number
  /** Device preferred rate as reported by AudioManager (0 if unavailable). */
  deviceSampleRate: number
  bufferSize: number
  windowSize: number
  /** Input low-pass cutoff in use (Hz), 0 = off. */
  lowpassHz: number
  rmsThreshold: number
}

/** Mutable counters, read by the hook on its own schedule. */
export type TunerStats = {
  callbacks: number
  analyses: number
  analysisMsTotal: number
  /** Capture-time vs wall-clock drift since the first callback (ms). */
  lagMs: number
  /** Recorder onError events (buffer overflow etc.). Counted, not fatal. */
  errors: number
  lastError: string | null
  /** Analyses that produced a frequency. */
  voiced: number
  /** Rejected by the RMS gate. */
  rejGate: number
  /** Rejected by the clarity threshold. */
  rejClarity: number
  /** No key maximum in range. */
  rejNoPeak: number
  /** Newest analysis diagnostics (even when rejected); null before the first. */
  last: MpmDebug | null
}

export type TunerHandle = {
  stop(): void
  readonly info: TunerInfo
  readonly stats: TunerStats
}

/** 'interrupted': a call / another app / Siri took the audio session (see robustness.ts). */
export type TunerErrorKind = 'denied' | 'interrupted' | 'other'

export class TunerError extends Error {
  readonly kind: TunerErrorKind
  constructor(kind: TunerErrorKind, message: string) {
    super(message)
    this.name = 'TunerError'
    this.kind = kind
  }
}

export type StartTunerOptions = {
  preset?: TunerPreset
  /** Override the preset's RMS gate. */
  rmsThreshold?: number
}

// --- module state -----------------------------------------------------------

let recorder: AudioRecorder | null = null
function getRecorder(): AudioRecorder {
  // Docs recommend a single instance. Default options = raw mic (Android
  // `voiceRecognition` preset, no iOS voice processing): no AGC / NS.
  if (!recorder) recorder = new AudioRecorder()
  return recorder
}

type Session = { stopped: boolean }
let activeSession: Session | null = null

// Start/stop operations on the shared recorder run strictly in order.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch(() => undefined)
  return run
}

const now: () => number =
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now()

function deviceRate(): number {
  try {
    const r = AudioManager.getDevicePreferredSampleRate()
    return Number.isFinite(r) && r > 0 ? r : 0
  } catch {
    return 0
  }
}

/** Detach callbacks synchronously, then stop the recorder (queued). */
function teardown(session: Session): Promise<void> {
  session.stopped = true
  if (activeSession !== session) return Promise.resolve()
  activeSession = null
  const rec = getRecorder()
  rec.clearOnAudioReady()
  rec.clearOnError()
  // stop() reports failures via Result (e.g. "not recording"); nothing to do.
  return rec.stop().then(
    () => undefined,
    () => undefined,
  )
}

// --- public API -------------------------------------------------------------

export function startTuner(
  onSample: (s: PitchSample) => void,
  opts: StartTunerOptions = {},
): Promise<TunerHandle> {
  const preset = opts.preset ?? DEFAULT_TUNER_PRESET
  return serial(async () => {
    if (activeSession) await teardown(activeSession)

    if (!(await requestMicPermission())) {
      throw new TunerError('denied', 'Microphone permission denied.')
    }
    try {
      await configureAudioSession('tuner')
    } catch (e) {
      throw new TunerError('other', `Audio session: ${e instanceof Error ? e.message : String(e)}`)
    }

    const cfg = PRESETS[preset]
    const deviceSampleRate = deviceRate()
    const sampleRate = cfg.sampleRate ?? (deviceSampleRate || FALLBACK_SAMPLE_RATE)
    const info: TunerInfo = {
      preset,
      sampleRate,
      deviceSampleRate,
      bufferSize: cfg.bufferLength,
      windowSize: cfg.windowSize,
      lowpassHz: 0,
      rmsThreshold: opts.rmsThreshold ?? cfg.rmsThreshold,
    }
    const stats: TunerStats = {
      callbacks: 0,
      analyses: 0,
      analysisMsTotal: 0,
      lagMs: 0,
      errors: 0,
      lastError: null,
      voiced: 0,
      rejGate: 0,
      rejClarity: 0,
      rejNoPeak: 0,
      last: null,
    }

    const mpmOpts = {
      bufferSize: cfg.windowSize,
      hopSize: cfg.bufferLength,
      lowpassHz: cfg.lowpassHz,
      rmsThreshold: info.rmsThreshold,
    }
    let detector = new MpmDetector(sampleRate, mpmOpts)
    info.lowpassHz = detector.lowpassHz
    let detectorRate = sampleRate
    let wall0 = 0
    let when0 = 0

    const session: Session = { stopped: false }
    const rec = getRecorder()

    rec.onError(({ message }) => {
      stats.errors++
      stats.lastError = message
    })

    const reg = rec.onAudioReady(
      { sampleRate, bufferLength: cfg.bufferLength, channelCount: 1 },
      ({ buffer, when }) => {
        if (session.stopped) return
        const t = now()
        if (stats.callbacks === 0) {
          wall0 = t
          when0 = when
        } else {
          stats.lagMs = t - wall0 - (when - when0) * 1000
        }
        stats.callbacks++

        // The lib resamples to the requested rate; guard anyway.
        if (buffer.sampleRate !== detectorRate && buffer.sampleRate > 0) {
          detectorRate = buffer.sampleRate
          info.sampleRate = detectorRate
          detector = new MpmDetector(detectorRate, mpmOpts)
          info.lowpassHz = detector.lowpassHz
        }

        const s = detector.push(buffer.getChannelData(0))
        if (s) {
          stats.analyses++
          stats.analysisMsTotal += now() - t
          // Fresh object per analysis (~23/s) so consumers can hold/compare it.
          const d = detector.lastDebug
          stats.last = { ...d }
          if (d.reason === 'ok') stats.voiced++
          else if (d.reason === 'gate') stats.rejGate++
          else if (d.reason === 'clarity') stats.rejClarity++
          else stats.rejNoPeak++
          onSample(s)
        }
      },
    )

    activeSession = session
    if (reg.status === 'error') {
      await teardown(session)
      throw new TunerError('other', `onAudioReady: ${reg.message}`)
    }

    const res = await rec.start()
    if (res.status === 'error') {
      await teardown(session)
      throw new TunerError('other', `Recorder start: ${res.message}`)
    }

    return {
      info,
      stats,
      stop() {
        if (session.stopped) return
        session.stopped = true
        void serial(() => teardown(session))
        detector.reset()
      },
    }
  })
}
