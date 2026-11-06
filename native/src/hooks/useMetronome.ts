// Shared metronome state. `useMetronomeController` runs once inside MetronomeProvider
// (mounted above the navigator, so playback survives tab switches); screens read it with
// `useMetronome()`. Beat events are not React state at provider level (that would re-render
// the tree ~16x/s): consumers subscribe, and `useMetronome({ live })` keeps a local activeBeat.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { AudioContext } from 'react-native-audio-api'
import {
  acquireFocus,
  configureAudioSession,
  getAudioContext,
  getPrivateOutputIds,
  releaseFocus,
  startBackgroundPlayback,
  stopBackgroundPlayback,
  subscribeAudioEvents,
  subscribeRemoteStop,
  type RawAudioEvent,
} from '../audio/session'
import {
  DEFAULT_RESUME_POLICY,
  PAUSED_MESSAGES,
  isContextStalled,
  lostPrivateOutput,
  metronomeReaction,
  type AudioEvt,
  type PausedReason,
} from '../audio/robustness'
import {
  DEFAULT_METRONOME,
  ENGINE_MODE,
  MetronomeEngine,
  clampBpm,
  clampNumerator,
  fitArrayLength,
  sanitizeConfig,
  type BeatEvent,
  type CountInBars,
  type Denominator,
  type MetronomeConfig,
  type Subdivision,
} from '../audio/metronome'
import { usePersistentState } from '../settings'

export { MAX_BPM, MAX_NUMERATOR, MIN_BPM, MIN_NUMERATOR } from '../audio/metronome'

export const METRONOME_CONFIG_KEY = 'tunepulse:metronome-config'
const NOTIFICATION_TITLE = 'TunePulse metronome'
const FOCUS_OWNER = 'metronome'
/** Wall interval for the foreground stall check. */
const STALL_CHECK_MS = 300

/** Read-only snapshot for Settings → Diagnostics (task 12). */
export type EngineDiagnostics = {
  /** AudioContext state, or 'not created' before the first start. */
  contextState: string
  sampleRate: number
  /** Engine implementation, 'loop-buffer'. */
  mode: string
  /** Android foreground-service notification shown (always false on iOS). */
  backgroundPlayback: boolean
  error: string | null
}

export type BeatListener = (evt: BeatEvent) => void

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function hapticFor(evt: BeatEvent) {
  const style = evt.isAccent
    ? Haptics.ImpactFeedbackStyle.Heavy
    : evt.isDownbeat
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Light
  void Haptics.impactAsync(style).catch(() => undefined)
}

export function useMetronomeController() {
  const [config, setConfig, hydrated] = usePersistentState<MetronomeConfig>(
    METRONOME_CONFIG_KEY,
    DEFAULT_METRONOME,
    sanitizeConfig,
  )
  const [isRunning, setIsRunning] = useState(false)
  /** Wall-clock ms when the current run started; null while stopped. */
  const [startedAt, setStartedAt] = useState<number | null>(null)
  /** countInBars snapshot of the current run (changes mid-run apply on the next start). */
  const [runCountInBars, setRunCountInBars] = useState<CountInBars>(0)
  const [error, setError] = useState<string | null>(null)
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  /** Why the metronome stopped on its own (interruption, headphones, stall, output error). */
  const [pausedReason, setPausedReason] = useState<PausedReason | null>(null)

  const engineRef = useRef<MetronomeEngine | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const configRef = useRef(config)
  const busyRef = useRef(false)
  const backgroundRef = useRef(false)
  const errorRef = useRef<string | null>(null)
  const listenersRef = useRef(new Set<BeatListener>())
  const pausedRef = useRef<{ reason: PausedReason | null; at: number | null }>({ reason: null, at: null })
  /** Private outputs (headphones / BT / USB) connected while running, for "unplugged" detection. */
  const privateOutputsRef = useRef<string[]>([])

  const reportError = useCallback((msg: string | null) => {
    errorRef.current = msg
    setError(msg)
  }, [])

  useEffect(() => {
    configRef.current = config
    engineRef.current?.setConfig(config)
    engineRef.current?.setMuted(config.hapticMode)
  }, [config])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'))
    return () => sub.remove()
  }, [])

  // Foreground poll drives UI beats and haptics; the audio never depends on it.
  useEffect(() => {
    engineRef.current?.setUiActive(appActive && isRunning)
  }, [appActive, isRunning])

  useEffect(() => {
    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
      releaseFocus(FOCUS_OWNER)
      void stopBackgroundPlayback().catch(() => undefined)
    }
  }, [])

  const handleBeat = useCallback((evt: BeatEvent) => {
    if (configRef.current.hapticMode) hapticFor(evt)
    for (const listener of listenersRef.current) listener(evt)
  }, [])

  const subscribeBeat = useCallback((listener: BeatListener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const setPaused = useCallback((reason: PausedReason | null) => {
    pausedRef.current = { reason, at: reason ? Date.now() : null }
    setPausedReason(reason)
  }, [])

  /** Tear down a run. `keepFocus` only for the (off by default) auto-resume policy. */
  const halt = useCallback((keepFocus = false) => {
    engineRef.current?.stop()
    engineRef.current?.setUiActive(false)
    setIsRunning(false)
    setStartedAt(null)
    backgroundRef.current = false
    if (!keepFocus) releaseFocus(FOCUS_OWNER)
    void stopBackgroundPlayback().catch(() => undefined)
  }, [])

  const start = useCallback(async () => {
    if (busyRef.current || engineRef.current?.running) return
    busyRef.current = true
    reportError(null)
    setPaused(null)
    try {
      await configureAudioSession('metronome')
      const ctx = getAudioContext()
      ctxRef.current = ctx
      // Always resume: after an Android output failure (ctx.onerror) the state can still read
      // 'running' with the driver stopped; resume() restarts it and is a no-op when healthy.
      await ctx.resume()
      if (!engineRef.current) engineRef.current = new MetronomeEngine(ctx)
      const engine = engineRef.current
      acquireFocus(FOCUS_OWNER)
      engine.setOnBeat(handleBeat)
      engine.setMuted(configRef.current.hapticMode)
      engine.start(configRef.current)
      engine.setUiActive(AppState.currentState === 'active')
      setIsRunning(true)
      setStartedAt(Date.now())
      setRunCountInBars(configRef.current.countInBars)
      void getPrivateOutputIds().then((ids) => {
        privateOutputsRef.current = ids
      })
      try {
        await startBackgroundPlayback(NOTIFICATION_TITLE)
        backgroundRef.current = true
      } catch (e) {
        reportError(`Background playback unavailable: ${errorMessage(e)}`)
      }
    } catch (e) {
      releaseFocus(FOCUS_OWNER)
      reportError(`Could not start audio: ${errorMessage(e)}`)
    } finally {
      busyRef.current = false
    }
  }, [handleBeat, reportError, setPaused])

  const stop = useCallback(() => {
    setPaused(null)
    halt()
  }, [halt, setPaused])

  // Apply the robustness policy to one event (see src/audio/robustness.ts).
  const dispatchRef = useRef<(evt: AudioEvt) => void>(() => undefined)
  useEffect(() => {
    dispatchRef.current = (evt: AudioEvt) => {
      const running = !!engineRef.current?.running
      const reaction = metronomeReaction(
        { running, pausedReason: pausedRef.current.reason, pausedAt: pausedRef.current.at },
        evt,
        Date.now(),
      )
      if (reaction.action === 'stop') {
        const keepFocus = reaction.reason === 'interrupted' && DEFAULT_RESUME_POLICY.autoResumeAfterTransient
        halt(keepFocus)
        setPaused(reaction.reason)
      } else if (reaction.action === 'resume') {
        void start()
      }
      // Interruption over without resuming: drop focus kept for auto-resume.
      if (evt.kind === 'interruptionEnded' && reaction.action !== 'resume' && !engineRef.current?.running) {
        releaseFocus(FOCUS_OWNER)
      }
    }
  }, [halt, setPaused, start])

  // System events: subscribed while running (and while an interruption could auto-resume).
  const listening = isRunning || (pausedReason === 'interrupted' && DEFAULT_RESUME_POLICY.autoResumeAfterTransient)
  useEffect(() => {
    if (!listening) return
    const dispatch = (evt: AudioEvt) => dispatchRef.current(evt)
    const offAudio = subscribeAudioEvents((raw: RawAudioEvent) => {
      if (raw.type === 'interruption') {
        dispatch(raw.began ? { kind: 'interruptionBegan' } : { kind: 'interruptionEnded', shouldResume: raw.shouldResume })
      } else if (raw.type === 'duck') {
        dispatch({ kind: 'duck' })
      } else if (raw.reason === 'NewDeviceAvailable') {
        void getPrivateOutputIds().then((ids) => {
          privateOutputsRef.current = ids
        })
        dispatch({ kind: 'routeAdded' })
      } else if (raw.reason === 'OldDeviceUnavailable') {
        const before = privateOutputsRef.current
        void getPrivateOutputIds().then((ids) => {
          privateOutputsRef.current = ids
          dispatch({ kind: 'routeLost', lostPrivate: lostPrivateOutput(before, ids) })
        })
      }
    })
    const offRemote = subscribeRemoteStop(() => dispatch({ kind: 'remoteStop' }))
    const ctx = ctxRef.current
    if (ctx) ctx.onerror = () => dispatch({ kind: 'contextError' })
    return () => {
      offAudio()
      offRemote()
      if (ctx) ctx.onerror = null
    }
  }, [listening])

  // Back in the foreground while "running": make sure the audio clock is really moving, so the
  // UI never shows running while silent (long background, OS-paused engine, dead stream).
  // Only on a background -> foreground transition (not right after start, while the stream opens).
  const wasActiveRef = useRef(appActive)
  useEffect(() => {
    const cameBack = appActive && !wasActiveRef.current
    wasActiveRef.current = appActive
    if (!cameBack || !engineRef.current?.running) return
    const ctx = ctxRef.current
    if (!ctx) return
    const t0 = ctx.currentTime
    const wall0 = Date.now()
    const id = setTimeout(() => {
      if (isContextStalled(t0, ctx.currentTime, Date.now() - wall0, ctx.state)) {
        dispatchRef.current({ kind: 'stalled' })
      }
    }, STALL_CHECK_MS)
    return () => clearTimeout(id)
  }, [appActive])

  const toggle = useCallback(() => {
    if (engineRef.current?.running) stop()
    else void start()
  }, [start, stop])

  const setBpm = useCallback(
    (bpm: number) => setConfig((c) => ({ ...c, bpm: clampBpm(bpm) })),
    [setConfig],
  )

  const setCountInBars = useCallback(
    (countInBars: CountInBars) => setConfig((c) => ({ ...c, countInBars })),
    [setConfig],
  )

  const setNumerator = useCallback(
    (value: number) =>
      setConfig((c) => {
        const numerator = clampNumerator(value)
        return {
          ...c,
          numerator,
          beats: {
            accents: c.beats.accents.filter((b) => b <= numerator),
            subdivisions: fitArrayLength<Subdivision>(c.beats.subdivisions, numerator, 1),
          },
        }
      }),
    [setConfig],
  )

  const setDenominator = useCallback(
    (denominator: Denominator) => setConfig((c) => ({ ...c, denominator })),
    [setConfig],
  )

  const toggleAccent = useCallback(
    (beat: number) =>
      setConfig((c) => {
        const accents = c.beats.accents.includes(beat)
          ? c.beats.accents.filter((b) => b !== beat)
          : [...c.beats.accents, beat].sort((a, b) => a - b)
        return { ...c, beats: { ...c.beats, accents } }
      }),
    [setConfig],
  )

  const setSubdivision = useCallback(
    (beatIndex: number, value: Subdivision) =>
      setConfig((c) => {
        if (beatIndex < 0 || beatIndex >= c.numerator) return c
        const subdivisions = c.beats.subdivisions.slice()
        subdivisions[beatIndex] = value
        return { ...c, beats: { ...c.beats, subdivisions } }
      }),
    [setConfig],
  )

  const setHapticMode = useCallback(
    (hapticMode: boolean) => setConfig((c) => ({ ...c, hapticMode })),
    [setConfig],
  )

  const applyConfig = useCallback((next: MetronomeConfig) => setConfig(sanitizeConfig(next)), [setConfig])

  const getEngineDiagnostics = useCallback((): EngineDiagnostics => {
    const ctx = ctxRef.current
    return {
      contextState: ctx ? ctx.state : 'not created',
      sampleRate: ctx ? ctx.sampleRate : 0,
      mode: ENGINE_MODE,
      backgroundPlayback: backgroundRef.current,
      error: errorRef.current,
    }
  }, [])

  return useMemo(
    () => ({
      config,
      hydrated,
      isRunning,
      startedAt,
      runCountInBars,
      error,
      pausedReason,
      pausedMessage: pausedReason ? PAUSED_MESSAGES[pausedReason] : null,
      start,
      stop,
      toggle,
      setBpm,
      setCountInBars,
      setNumerator,
      setDenominator,
      toggleAccent,
      setSubdivision,
      setHapticMode,
      applyConfig,
      subscribeBeat,
      getEngineDiagnostics,
    }),
    [
      config,
      hydrated,
      isRunning,
      startedAt,
      runCountInBars,
      error,
      pausedReason,
      start,
      stop,
      toggle,
      setBpm,
      setCountInBars,
      setNumerator,
      setDenominator,
      toggleAccent,
      setSubdivision,
      setHapticMode,
      applyConfig,
      subscribeBeat,
      getEngineDiagnostics,
    ],
  )
}

export type MetronomeContextValue = ReturnType<typeof useMetronomeController>

export const MetronomeContext = createContext<MetronomeContextValue | null>(null)

/**
 * Metronome API (web parity) + `activeBeat`. Pass `live: false` when the caller is not
 * visible (e.g. an unfocused tab) to stop beat-rate re-renders; playback is unaffected.
 */
export function useMetronome({ live = true }: { live?: boolean } = {}) {
  const ctx = useContext(MetronomeContext)
  if (!ctx) throw new Error('useMetronome must be used inside MetronomeProvider')
  const { subscribeBeat, isRunning, startedAt } = ctx
  // Tagged with the run so a beat from the previous run never shows after a restart.
  const [beat, setBeat] = useState<{ evt: BeatEvent; run: number | null } | null>(null)

  useEffect(() => {
    if (!live || !isRunning) return
    return subscribeBeat((evt) => setBeat({ evt, run: startedAt }))
  }, [live, isRunning, startedAt, subscribeBeat])

  const activeBeat = live && isRunning && beat && beat.run === startedAt ? beat.evt : null
  return { ...ctx, activeBeat }
}
