import { useCallback, useEffect, useRef, useState } from 'react'
import { getAudioContext, resumeAudioContext } from '../audio/audioContext'
import {
  DEFAULT_METRONOME,
  MetronomeEngine,
  type BeatEvent,
  type MetronomeConfig,
} from '../audio/metronomeScheduler'

export const MIN_BPM = 30
export const MAX_BPM = 300

export function useMetronome() {
  const [config, setConfig] = useState<MetronomeConfig>(DEFAULT_METRONOME)
  const [isRunning, setIsRunning] = useState(false)
  const [activeBeat, setActiveBeat] = useState<BeatEvent | null>(null)
  const engineRef = useRef<MetronomeEngine | null>(null)

  useEffect(() => {
    return () => {
      engineRef.current?.stop()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setConfig(config)
  }, [config])

  const start = useCallback(async () => {
    await resumeAudioContext()
    const ctx = getAudioContext()
    if (!engineRef.current) {
      engineRef.current = new MetronomeEngine(ctx, config)
    } else {
      engineRef.current.setConfig(config)
    }
    engineRef.current.setOnBeat((evt) => setActiveBeat(evt))
    engineRef.current.start()
    setIsRunning(true)
  }, [config])

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

  return { config, isRunning, activeBeat, start, stop, toggle, setBpm, setConfig }
}
