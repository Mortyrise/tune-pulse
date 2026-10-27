import type { ReactNode } from 'react'
import { MetronomeContext } from './metronomeContext'
import { useMetronome } from './useMetronome'

export function MetronomeProvider({ children }: { children: ReactNode }) {
  const metronome = useMetronome()
  return <MetronomeContext.Provider value={metronome}>{children}</MetronomeContext.Provider>
}
