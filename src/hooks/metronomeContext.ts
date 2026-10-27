import { createContext, useContext } from 'react'
import type { useMetronome } from './useMetronome'

export type MetronomeContextValue = ReturnType<typeof useMetronome>

export const MetronomeContext = createContext<MetronomeContextValue | null>(null)

/** Shared metronome: lives above the router so it keeps playing across tabs. */
export function useMetronomeContext(): MetronomeContextValue {
  const ctx = useContext(MetronomeContext)
  if (!ctx) {
    throw new Error('useMetronomeContext must be used inside MetronomeProvider')
  }
  return ctx
}
