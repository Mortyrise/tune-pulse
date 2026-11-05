// Shared metronome state. `useMetronomeController` runs once inside MetronomeProvider
// (mounted above the navigator, so playback survives tab switches); screens read it with
// `useMetronome()`. Beat events are not React state at provider level (that would re-render
// the tree ~16x/s): consumers subscribe, and `useMetronome({ live })` keeps a local activeBeat.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { AudioContext } from 'react-native-audio-api'
import {
  configureAudioSession,
  getAudioContext,
  startBackgroundPlayback,
  stopBackgroundPlayback,
} from '../audio/session'
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

  const engineRef = useRef<MetronomeEngine | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const configRef = useRef(config)
  const busyRef = useRef(false)
  const backgroundRef = useRef(false)
  const errorRef = useRef<string | null>(null)
  const listenersRef = useRef(new Set<BeatListener>())

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

  const start = useCallback(async () => {
    if (busyRef.current || engineRef.current?.running) return
    busyRef.current = true
    reportError(null)
    try {
      await configureAudioSession('metronome')
      const ctx = getAudioContext()
      ctxRef.current = ctx
      if (ctx.state !== 'running') await ctx.resume()
      if (!engineRef.current) engineRef.current = new MetronomeEngine(ctx)
      const engine = engineRef.current
      engine.setOnBeat(handleBeat)
      engine.setMuted(configRef.current.hapticMode)
      engine.start(configRef.current)
      engine.setUiActive(AppState.currentState === 'active')
      setIsRunning(true)
      setStartedAt(Date.now())
      setRunCountInBars(configRef.current.countInBars)
      try {
        await startBackgroundPlayback(NOTIFICATION_TITLE)
        backgroundRef.current = true
      } catch (e) {
        reportError(`background: ${errorMessage(e)}`)
      }
    } catch (e) {
      reportError(errorMessage(e))
    } finally {
      busyRef.current = false
    }
  }, [handleBeat, reportError])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    engineRef.current?.setUiActive(false)
    setIsRunning(false)
    setStartedAt(null)
    backgroundRef.current = false
    void stopBackgroundPlayback().catch(() => undefined)
  }, [])

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
