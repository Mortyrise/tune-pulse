import { useCallback, useRef } from 'react'

const TAP_WINDOW = 4
const RESET_AFTER_MS = 2000

export type UseTapTempoOptions = {
  onBpm: (bpm: number) => void
}

export function useTapTempo({ onBpm }: UseTapTempoOptions) {
  const tapsRef = useRef<number[]>([])

  const tap = useCallback(() => {
    const now = performance.now()
    const taps = tapsRef.current
    const last = taps[taps.length - 1]

    if (last !== undefined && now - last > RESET_AFTER_MS) {
      tapsRef.current = [now]
      return
    }

    taps.push(now)
    if (taps.length > TAP_WINDOW) {
      taps.shift()
    }

    if (taps.length < 2) {
      return
    }

    const intervals: number[] = []
    for (let i = 1; i < taps.length; i++) {
      intervals.push(taps[i] - taps[i - 1])
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const bpm = Math.round(60_000 / mean)
    onBpm(bpm)
  }, [onBpm])

  const reset = useCallback(() => {
    tapsRef.current = []
  }, [])

  return { tap, reset }
}
