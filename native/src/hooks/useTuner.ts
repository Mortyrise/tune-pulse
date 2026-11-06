import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import type { PitchSample } from '../core/mpm'
import {
  DEFAULT_TUNER_PRESET,
  startTuner,
  TunerError,
  type TunerErrorKind,
  type TunerHandle,
  type TunerInfo,
  type TunerPreset,
  type TunerStats,
} from '../audio/tuner'
import {
  initialView,
  reduceView,
  type TunerView,
  type ViewConfig,
  type ViewEvent,
} from '../tuner-ui/display'
import { subscribeAudioEvents, type RawAudioEvent } from '../audio/session'
import { TUNER_INTERRUPTED_MESSAGE, tunerReaction, type AudioEvt } from '../audio/robustness'

export type TunerStatus = 'idle' | 'starting' | 'running' | 'error'

export type TunerHookError = { kind: TunerErrorKind; message: string }

export type TunerDebug = TunerInfo &
  Pick<TunerStats, 'voiced' | 'rejGate' | 'rejClarity' | 'rejNoPeak' | 'last'> & {
    analysesPerSec: number
    msPerAnalysis: number
    lagMs: number
    errors: number
    lastError: string | null
  }

const UI_INTERVAL_MS = 33 // ~30 fps
const STATS_INTERVAL_MS = 1000
/** Collapse bursts of route events (BT connect sends several) into one restart. */
const ROUTE_RESTART_DEBOUNCE_MS = 500
/** Ignore route events right after a (re)start: opening the mic can itself add/remove devices. */
const ROUTE_SETTLE_MS = 1500
const DEFAULT_VIEW_CONFIG: ViewConfig = { referenceA4: 440, inTuneCents: 5 }

/**
 * `sample` is the latest raw analysis (debug). `view` is the display state
 * (sticky note, smoothing, hold-to-confirm, history) folded from *every*
 * analysis via `reduceView`, published at most ~30 times/s.
 */
export function useTuner(viewConfig: ViewConfig = DEFAULT_VIEW_CONFIG) {
  const [status, setStatus] = useState<TunerStatus>('idle')
  const [error, setError] = useState<TunerHookError | null>(null)
  const [sample, setSample] = useState<PitchSample | null>(null)
  const [debug, setDebug] = useState<TunerDebug | null>(null)
  const [view, setView] = useState<TunerView>(() => initialView(viewConfig))

  const handleRef = useRef<TunerHandle | null>(null)
  const presetRef = useRef<TunerPreset>(DEFAULT_TUNER_PRESET)
  const startedAtRef = useRef(0)
  const tokenRef = useRef(0)
  const latestRef = useRef<PitchSample | null>(null)
  const dirtyRef = useRef(false)
  const queueRef = useRef<ViewEvent[]>([])
  const viewRef = useRef<TunerView>(view)
  const cfgRef = useRef<ViewConfig>(viewConfig)
  useEffect(() => {
    cfgRef.current = viewConfig
  }, [viewConfig])

  const resetView = useCallback(() => {
    queueRef.current = []
    viewRef.current = initialView(cfgRef.current)
    setView(viewRef.current)
  }, [])

  const stop = useCallback(() => {
    tokenRef.current++
    handleRef.current?.stop()
    handleRef.current = null
    latestRef.current = null
    dirtyRef.current = false
    setStatus('idle')
    setError(null)
    setSample(null)
    setDebug(null)
    resetView()
  }, [resetView])

  const start = useCallback(async (preset: TunerPreset = DEFAULT_TUNER_PRESET) => {
    // Any previous run (or in-flight start) is superseded.
    const token = ++tokenRef.current
    presetRef.current = preset
    startedAtRef.current = Date.now()
    handleRef.current?.stop()
    handleRef.current = null
    latestRef.current = null
    setStatus('starting')
    setError(null)
    setSample(null)
    setDebug(null)
    resetView()

    try {
      const handle = await startTuner(
        (s) => {
          latestRef.current = s
          dirtyRef.current = true
          if (token === tokenRef.current) {
            queueRef.current.push({ type: 'sample', sample: s, at: Date.now() })
          }
        },
        { preset },
      )
      if (token !== tokenRef.current) {
        handle.stop()
        return
      }
      handleRef.current = handle
      setStatus('running')
    } catch (e) {
      if (token !== tokenRef.current) return
      const err: TunerHookError =
        e instanceof TunerError
          ? { kind: e.kind, message: e.message }
          : { kind: 'other', message: e instanceof Error ? e.message : String(e) }
      setError(err)
      setStatus('error')
    }
  }, [resetView])

  // Publish at most ~30 times/s: fold queued analyses + a tick into the view
  // (sticky expiry / hold progress advance even in silence), and the latest
  // raw sample for debug.
  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => {
      const cfg = cfgRef.current
      let v = viewRef.current
      const events = queueRef.current
      queueRef.current = []
      for (const e of events) v = reduceView(v, e, cfg)
      v = reduceView(v, { type: 'tick', at: Date.now() }, cfg)
      if (v !== viewRef.current) {
        viewRef.current = v
        setView(v)
      }
      if (!dirtyRef.current) return
      dirtyRef.current = false
      setSample(latestRef.current)
    }, UI_INTERVAL_MS)
    return () => clearInterval(id)
  }, [status])

  // Debug stats once per second.
  useEffect(() => {
    if (status !== 'running') return
    let prevAnalyses = 0
    let prevMs = 0
    let prevT = Date.now()
    const tick = () => {
      const h = handleRef.current
      if (!h) return
      const t = Date.now()
      const { analyses, analysisMsTotal, lagMs, errors, lastError, voiced, rejGate, rejClarity, rejNoPeak, last } =
        h.stats
      const dA = analyses - prevAnalyses
      const dt = (t - prevT) / 1000
      setDebug({
        ...h.info,
        voiced,
        rejGate,
        rejClarity,
        rejNoPeak,
        last: last ? { ...last } : null,
        analysesPerSec: dt > 0 ? dA / dt : 0,
        msPerAnalysis: dA > 0 ? (analysisMsTotal - prevMs) / dA : 0,
        lagMs,
        errors,
        lastError,
      })
      prevAnalyses = analyses
      prevMs = analysisMsTotal
      prevT = t
    }
    tick()
    const id = setInterval(tick, STATS_INTERVAL_MS)
    return () => clearInterval(id)
  }, [status])

  // Interruptions (iOS; Android only while the metronome holds audio focus) stop the tuner
  // with a readable error, no auto-restart. A headphone / Bluetooth route change restarts it
  // with the same preset so it picks up the new input and rate (the recorder resamples to the
  // requested rate, and the detector rebuilds if the delivered rate ever changes).
  const busy = status === 'running' || status === 'starting'
  useEffect(() => {
    if (!busy) return
    let restartId: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = subscribeAudioEvents((raw: RawAudioEvent) => {
      const evt = toTunerEvt(raw)
      if (!evt) return
      const reaction = tunerReaction(true, evt)
      if (reaction === 'stop') {
        if (restartId !== null) clearTimeout(restartId)
        stop()
        setError({ kind: 'interrupted', message: TUNER_INTERRUPTED_MESSAGE })
        setStatus('error')
      } else if (reaction === 'restart') {
        if (Date.now() - startedAtRef.current < ROUTE_SETTLE_MS) return
        if (restartId !== null) clearTimeout(restartId)
        restartId = setTimeout(() => {
          restartId = null
          void start(presetRef.current)
        }, ROUTE_RESTART_DEBOUNCE_MS)
      }
    })
    return () => {
      if (restartId !== null) clearTimeout(restartId)
      unsubscribe()
    }
  }, [busy, start, stop])

  // iOS has UIBackgroundModes audio + playAndRecord: a running recorder would
  // keep capturing in background. Stop on 'background' / 'inactive'; no
  // auto-restart (user taps Start again).
  // Note: iOS also reports 'inactive' for Control Center / incoming call
  // banners; stopping there too is intended (conservative).
  useEffect(() => {
    if (!busy) return
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') stop()
    })
    return () => sub.remove()
  }, [busy, stop])

  // Unmount: invalidate any in-flight start and release the recorder.
  // (Refs copied so the cleanup doesn't read `.current` off the effect scope.)
  useEffect(() => {
    const tokens = tokenRef
    const handle = handleRef
    return () => {
      tokens.current++
      handle.current?.stop()
      handle.current = null
    }
  }, [])

  return { status, error, sample, debug, view, start, stop }
}

/** Only device add/remove matters to the tuner (ConfigurationChange is emitted by the recorder itself). */
function toTunerEvt(raw: RawAudioEvent): AudioEvt | null {
  if (raw.type === 'interruption') {
    return raw.began ? { kind: 'interruptionBegan' } : { kind: 'interruptionEnded', shouldResume: raw.shouldResume }
  }
  if (raw.type === 'duck') return { kind: 'duck' }
  if (raw.reason === 'NewDeviceAvailable') return { kind: 'routeAdded' }
  if (raw.reason === 'OldDeviceUnavailable') return { kind: 'routeLost', lostPrivate: false }
  return null
}
