import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  clampReferenceA4,
  DEFAULT_TUNER_SETTINGS,
  loadSettings,
  STORAGE_KEY,
  TunerSettingsContext,
  type TunerSettings,
} from './useTunerSettings'

export function TunerSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<TunerSettings>(loadSettings)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // storage full or disabled — silently ignore.
    }
  }, [settings])

  const updateSettings = useCallback((partial: Partial<TunerSettings>) => {
    setSettings((current) => {
      const next: TunerSettings = { ...current, ...partial }
      if (partial.referenceA4 !== undefined) {
        next.referenceA4 = clampReferenceA4(partial.referenceA4)
      }
      return next
    })
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_TUNER_SETTINGS)
  }, [])

  return (
    <TunerSettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </TunerSettingsContext.Provider>
  )
}
