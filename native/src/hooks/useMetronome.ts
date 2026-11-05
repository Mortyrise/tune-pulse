import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import * as Haptics from 'expo-haptics'
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
  type BeatEvent,
  type MetronomeConfig,
  type Subdivision,
} from '../audio/metronome'

export const MIN_BPM = 30
export const MAX_BPM = 300
export const MIN_NUMERATOR = 2
export const MAX_NUMERATOR = 7

const NOTIFICATION_TITLE = 'TunePulse metronome'

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(v)))
}

export type MetronomeDebug = {
  contextState: string
  sampleRate: number
  mode: string
  background: boolean
}

/** PoC config surface: one subdivision for every beat, accent on beat 1 on/off. No persistence. */
export function useMetronome({ uiActive = true }: { uiActive?: boolean } = {}) {
  const [config, setConfig] = useState<MetronomeConfig>(DEFAULT_METRONOME)
  const [isRunning, setIsRunning] = useState(false)
  const [activeBeat, setActiveBeat] = useState<BeatEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [background, setBackground] = useState(false)
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  const [ctxInfo, setCtxInfo] = useState({ state: 'not created', sampleRate: 0 })
  const engineRef = useRef<MetronomeEngine | null>(null)
  const configRef = useRef(config)
  const busyRef = useRef(false)
  const uiActiveRef = useRef(uiActive)

  useEffect(() => {
    uiActiveRef.current = uiActive
  }, [uiActive])

  useEffect(() => {
    configRef.current = config
    engineRef.current?.setConfig(config)
  }, [config])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      setAppActive(s === 'active')
      // Refresh the debug snapshot when coming back (did the context survive background?).
      if (s === 'active' && engineRef.current) {
        const ctx = getAudioContext()
        setCtxInfo({ state: ctx.state, sampleRate: ctx.sampleRate })
      }
    })
    return () => sub.remove()
  }, [])

  // UI beat polling only while visible; audio does not depend on it.
  const uiVisible = appActive && uiActive && isRunning
  useEffect(() => {
    engineRef.current?.setUiActive(uiVisible)
  }, [uiVisible])

  useEffect(() => {
    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
      void stopBackgroundPlayback().catch(() => undefined)
    }
  }, [])

  const handleBeat = useCallback((evt: BeatEvent) => {
    setActiveBeat(evt)
    if (configRef.current.hapticMode && evt.isDownbeat && evt.beat === 1) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
    }
  }, [])

  const start = useCallback(async () => {
    if (busyRef.current || engineRef.current?.running) return
    busyRef.current = true
    setError(null)
    try {
      await configureAudioSession('metronome')
      const ctx = getAudioContext()
      if (ctx.state !== 'running') await ctx.resume()
      if (!engineRef.current) engineRef.current = new MetronomeEngine(ctx)
      const engine = engineRef.current
      engine.setOnBeat(handleBeat)
      engine.start(configRef.current)
      engine.setUiActive(AppState.currentState === 'active' && uiActiveRef.current)
      setIsRunning(true)
      setCtxInfo({ state: ctx.state, sampleRate: ctx.sampleRate })
      try {
        await startBackgroundPlayback(NOTIFICATION_TITLE)
        setBackground(true)
      } catch (e) {
        setError(`background: ${e instanceof Error ? e.message : String(e)}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      busyRef.current = false
    }
  }, [handleBeat])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    setIsRunning(false)
    setActiveBeat(null)
    setBackground(false)
    void stopBackgroundPlayback().catch(() => undefined)
  }, [])

  const toggle = useCallback(() => {
    if (engineRef.current?.running) stop()
    else void start()
  }, [start, stop])

  const setBpm = useCallback((bpm: number) => {
    setConfig((c) => ({ ...c, bpm: clamp(bpm, MIN_BPM, MAX_BPM) }))
  }, [])

  const setNumerator = useCallback((n: number) => {
    setConfig((c) => {
      const numerator = clamp(n, MIN_NUMERATOR, MAX_NUMERATOR)
      const sub = c.beats.subdivisions[0] ?? 1
      return {
        ...c,
        numerator,
        beats: {
          accents: c.beats.accents.filter((b) => b <= numerator),
          subdivisions: Array<Subdivision>(numerator).fill(sub),
        },
      }
    })
  }, [])

  const setSubdivision = useCallback((sub: Subdivision) => {
    setConfig((c) => ({
      ...c,
      beats: { ...c.beats, subdivisions: Array<Subdivision>(c.numerator).fill(sub) },
    }))
  }, [])

  const setAccent = useCallback((on: boolean) => {
    setConfig((c) => ({ ...c, beats: { ...c.beats, accents: on ? [1] : [] } }))
  }, [])

  const setHaptics = useCallback((on: boolean) => {
    setConfig((c) => ({ ...c, hapticMode: on }))
  }, [])

  const debug: MetronomeDebug = {
    contextState: ctxInfo.state,
    sampleRate: ctxInfo.sampleRate,
    mode: ENGINE_MODE,
    background,
  }

  return {
    config,
    isRunning,
    activeBeat: uiVisible ? activeBeat : null,
    error,
    debug,
    start,
    stop,
    toggle,
    setBpm,
    setNumerator,
    setSubdivision,
    setAccent,
    setHaptics,
  }
}
