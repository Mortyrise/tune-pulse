// Persistence (AsyncStorage via ./storage) + tuner settings context.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_TUNER_SETTINGS, TUNER_SETTINGS_KEY, type TunerSettings } from './types'
import { sanitizeTunerSettings } from './sanitize'
import { decodeStored, getStorage } from './storage'

export * from './types'
export { clampReferenceA4, sanitizeTunerSettings } from './sanitize'

export type TunerSettingsApi = {
  settings: TunerSettings
  updateSettings: (patch: Partial<TunerSettings>) => void
  /** false until persisted values are loaded. */
  hydrated: boolean
}

const FALLBACK: TunerSettingsApi = {
  settings: DEFAULT_TUNER_SETTINGS,
  updateSettings: () => {},
  hydrated: true,
}

const Ctx = createContext<TunerSettingsApi>(FALLBACK)

export function TunerSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings, hydrated] = usePersistentState(
    TUNER_SETTINGS_KEY,
    DEFAULT_TUNER_SETTINGS,
    sanitizeTunerSettings,
  )
  const updateSettings = useCallback(
    (patch: Partial<TunerSettings>) => setSettings((prev) => sanitizeTunerSettings({ ...prev, ...patch })),
    [setSettings],
  )
  const value = useMemo(() => ({ settings, updateSettings, hydrated }), [settings, updateSettings, hydrated])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTunerSettings(): TunerSettingsApi {
  return useContext(Ctx)
}

export type PersistentSetter<T> = (next: T | ((prev: T) => T)) => void

/**
 * Generic persisted value (AsyncStorage, JSON). Starts at `initial` with
 * `hydrated=false`, then loads the stored value (passed through `validate`;
 * undefined → keep `initial`). A write made before hydration wins over the
 * late read. The setter is stable and accepts an updater function.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  validate?: (stored: unknown) => T | undefined,
): [T, PersistentSetter<T>, boolean] {
  const [state, setState] = useState<T>(initial)
  const [hydrated, setHydrated] = useState(false)
  const touched = useRef(false)
  const validateRef = useRef(validate)

  useEffect(() => {
    let cancelled = false
    getStorage()
      .getItem(key)
      .then((raw) => {
        if (cancelled) return
        if (!touched.current) {
          const stored = decodeStored(raw, validateRef.current)
          if (stored !== undefined) setState(stored)
        }
        setHydrated(true)
      })
      .catch(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [key])

  useEffect(() => {
    if (!touched.current) return
    getStorage()
      .setItem(key, JSON.stringify(state))
      .catch(() => {})
  }, [key, state])

  const set = useCallback<PersistentSetter<T>>((next) => {
    touched.current = true
    setState((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next))
  }, [])

  return [state, set, hydrated]
}
