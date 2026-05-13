import { useCallback, useEffect, useRef, useState } from 'react'
import { getAudioContext, resumeAudioContext } from '../audio/audioContext'
import {
  DEFAULT_METRONOME,
  MAX_NUMERATOR,
  MetronomeEngine,
  MIN_NUMERATOR,
  type BeatEvent,
  type CountInBars,
  type Denominator,
  type MetronomeConfig,
  type Subdivision,
} from '../audio/metronomeScheduler'

export const MIN_BPM = 30
export const MAX_BPM = 300

const ACCENT_VIBRATION_MS = 60
const DOWNBEAT_VIBRATION_MS = 40
const SUBDIVISION_VIBRATION_MS = 20

function fitArrayLength<T>(array: T[], length: number, fill: T): T[] {
  if (array.length === length) {
    return array
  }
  if (array.length < length) {
    return [...array, ...Array<T>(length - array.length).fill(fill)]
  }
  return array.slice(0, length)
}

export function useMetronome() {
  const [config, setConfig] = useState<MetronomeConfig>(DEFAULT_METRONOME)
  const [isRunning, setIsRunning] = useState(false)
  const [activeBeat, setActiveBeat] = useState<BeatEvent | null>(null)
  const engineRef = useRef<MetronomeEngine | null>(null)
  const configRef = useRef(config)

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    return () => {
      engineRef.current?.stop()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setConfig(config)
  }, [config])

  const handleBeat = useCallback((evt: BeatEvent) => {
    setActiveBeat(evt)
    if (!configRef.current.hapticMode) {
      return
    }
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return
    }
    const duration = evt.isAccent
      ? ACCENT_VIBRATION_MS
      : evt.isDownbeat
        ? DOWNBEAT_VIBRATION_MS
        : SUBDIVISION_VIBRATION_MS
    navigator.vibrate(duration)
  }, [])

  const start = useCallback(async () => {
    await resumeAudioContext()
    const ctx = getAudioContext()
    if (!engineRef.current) {
      engineRef.current = new MetronomeEngine(ctx, configRef.current)
    } else {
      engineRef.current.setConfig(configRef.current)
    }
    engineRef.current.setOnBeat(handleBeat)
    engineRef.current.start()
    setIsRunning(true)
  }, [handleBeat])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    engineRef.current?.setOnBeat(null)
    setIsRunning(false)
    setActiveBeat(null)
  }, [])

  const toggle = useCallback(() => {
    if (isRunning) {
      stop()
    } else {
      void start()
    }
  }, [isRunning, start, stop])

  const setBpm = useCallback((bpm: number) => {
    setConfig((c) => ({ ...c, bpm: Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm))) }))
  }, [])

  const setCountInBars = useCallback((bars: CountInBars) => {
    setConfig((c) => ({ ...c, countInBars: bars }))
  }, [])

  const setNumerator = useCallback((value: number) => {
    const next = Math.max(MIN_NUMERATOR, Math.min(MAX_NUMERATOR, Math.round(value)))
    setConfig((c) => {
      const subdivisions = fitArrayLength<Subdivision>(c.beats.subdivisions, next, 1)
      const accents = c.beats.accents.filter((beat) => beat <= next)
      return { ...c, numerator: next, beats: { accents, subdivisions } }
    })
  }, [])

  const setDenominator = useCallback((denominator: Denominator) => {
    setConfig((c) => ({ ...c, denominator }))
  }, [])

  const toggleAccent = useCallback((beat: number) => {
    setConfig((c) => {
      const accents = c.beats.accents.includes(beat)
        ? c.beats.accents.filter((b) => b !== beat)
        : [...c.beats.accents, beat].sort((a, b) => a - b)
      return { ...c, beats: { ...c.beats, accents } }
    })
  }, [])

  const setSubdivision = useCallback((beatIndex: number, value: Subdivision) => {
    setConfig((c) => {
      const subdivisions = c.beats.subdivisions.slice()
      subdivisions[beatIndex] = value
      return { ...c, beats: { ...c.beats, subdivisions } }
    })
  }, [])

  const setHapticMode = useCallback((enabled: boolean) => {
    setConfig((c) => ({ ...c, hapticMode: enabled }))
  }, [])

  const applyConfig = useCallback((next: MetronomeConfig) => {
    setConfig(next)
  }, [])

  return {
    config,
    isRunning,
    activeBeat,
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
  }
}
