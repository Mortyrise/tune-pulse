import { useCallback, useRef } from 'react'
import { registerTap } from '../core/tempo'

export type UseTapTempoOptions = {
  onBpm: (bpm: number) => void
}

export function useTapTempo({ onBpm }: UseTapTempoOptions) {
  const tapsRef = useRef<number[]>([])

  const tap = useCallback(() => {
    const bpm = registerTap(tapsRef.current, performance.now())
    if (bpm !== null) onBpm(bpm)
  }, [onBpm])

  const reset = useCallback(() => {
    tapsRef.current = []
  }, [])

  return { tap, reset }
}
