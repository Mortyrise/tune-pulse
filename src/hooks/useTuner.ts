import { useEffect, useRef, useState } from 'react'
import { getAudioContext, requestMicrophone, resumeAudioContext } from '../audio/audioContext'
import {
  startPitchDetection,
  type PitchDetectorHandle,
  type PitchSample,
} from '../audio/pitchDetector'

export type TunerStatus = 'idle' | 'starting' | 'running' | 'error'

export type TunerState = {
  status: TunerStatus
  sample: PitchSample | null
  error: string | null
}

const INITIAL_STATE: TunerState = {
  status: 'idle',
  sample: null,
  error: null,
}

export function useTuner(enabled: boolean) {
  const [state, setState] = useState<TunerState>(INITIAL_STATE)
  const handleRef = useRef<PitchDetectorHandle | null>(null)

  useEffect(() => {
    if (!enabled) {
      handleRef.current?.stop()
      handleRef.current = null
      setState(INITIAL_STATE)
      return
    }

    let cancelled = false
    setState({ status: 'starting', sample: null, error: null })

    ;(async () => {
      try {
        await resumeAudioContext()
        const ctx = getAudioContext()
        const stream = await requestMicrophone()
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const handle = await startPitchDetection(ctx, stream, (sample) => {
          if (cancelled) return
          setState({ status: 'running', sample, error: null })
        })
        handleRef.current = handle
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Unknown error'
        setState({ status: 'error', sample: null, error: message })
      }
    })()

    return () => {
      cancelled = true
      handleRef.current?.stop()
      handleRef.current = null
    }
  }, [enabled])

  return state
}
