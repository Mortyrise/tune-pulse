import { useCallback, useEffect, useRef, useState } from 'react'
import { getAudioContext, requestMicrophone } from '../audio/audioContext'
import {
  startPitchDetection,
  type PitchDetectorHandle,
  type PitchSample,
} from '../audio/pitchDetector'

export type TunerStatus = 'idle' | 'starting' | 'running' | 'error'

export type TunerErrorKind = 'denied' | 'not-found' | 'busy' | 'insecure' | 'other'

export type TunerError = {
  kind: TunerErrorKind
  message: string
  name: string
}

export type TunerState = {
  status: TunerStatus
  sample: PitchSample | null
  error: TunerError | null
}

const INITIAL_STATE: TunerState = {
  status: 'idle',
  sample: null,
  error: null,
}

function classifyMicError(err: unknown): TunerError {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return {
          kind: 'denied',
          name: err.name,
          message: 'Microphone access is blocked for this site.',
        }
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return {
          kind: 'not-found',
          name: err.name,
          message: 'No microphone detected on this device.',
        }
      case 'NotReadableError':
      case 'TrackStartError':
        return {
          kind: 'busy',
          name: err.name,
          message: 'Microphone is in use by another app.',
        }
      case 'SecurityError':
        return {
          kind: 'insecure',
          name: err.name,
          message: 'Microphone access requires a secure (HTTPS) connection.',
        }
      default:
        return {
          kind: 'other',
          name: err.name,
          message: `Microphone error: ${err.name}`,
        }
    }
  }
  const message = err instanceof Error ? err.message : 'Unknown microphone error.'
  const name = err instanceof Error ? err.name : 'Error'
  return { kind: 'other', name, message }
}

export function useTuner() {
  const [state, setState] = useState<TunerState>(INITIAL_STATE)
  const handleRef = useRef<PitchDetectorHandle | null>(null)
  const startingRef = useRef(false)

  useEffect(() => {
    return () => {
      handleRef.current?.stop()
      handleRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    if (handleRef.current || startingRef.current) {
      return
    }
    startingRef.current = true

    // Kick off mic request synchronously to preserve user-gesture activation.
    const ctx = getAudioContext()
    const resumePromise = ctx.resume()
    const streamPromise = requestMicrophone()

    setState({ status: 'starting', sample: null, error: null })

    try {
      await resumePromise
      const stream = await streamPromise
      const handle = await startPitchDetection(ctx, stream, (sample) => {
        setState((prev) =>
          prev.status === 'running'
            ? { ...prev, sample }
            : { status: 'running', sample, error: null },
        )
      })
      handleRef.current = handle
      setState({ status: 'running', sample: null, error: null })
    } catch (err) {
      setState({ status: 'error', sample: null, error: classifyMicError(err) })
    } finally {
      startingRef.current = false
    }
  }, [])

  const stop = useCallback(() => {
    handleRef.current?.stop()
    handleRef.current = null
    setState(INITIAL_STATE)
  }, [])

  return { state, start, stop }
}
