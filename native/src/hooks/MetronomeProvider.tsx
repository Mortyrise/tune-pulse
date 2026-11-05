// Mounted by the root layout above the navigator so the metronome keeps playing across tabs.
import type { ReactNode } from 'react'
import { MetronomeContext, useMetronomeController } from './useMetronome'

export function MetronomeProvider({ children }: { children: ReactNode }) {
  const value = useMetronomeController()
  return <MetronomeContext.Provider value={value}>{children}</MetronomeContext.Provider>
}
