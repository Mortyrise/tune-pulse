// Theme: light / dark / mono from the handoff tokens, persisted choice
// (follows the system until the user picks one), fonts via expo-font.
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { useFonts } from 'expo-font'
import { usePersistentState } from '../settings'
import { FONT_SOURCES } from './fonts'
import {
  APP_FONTS,
  LIGHT,
  SYSTEM_FONTS,
  THEME_COLORS,
  parseThemeMode,
  resolveThemeMode,
  preferenceFromStored,
  storedFromPreference,
  type ThemeColors,
  type ThemeFonts,
  type ThemeMode,
  type ThemePreference,
} from './tokens'

export * from './tokens'

export type Theme = {
  /** Resolved mode used for rendering. */
  mode: ThemeMode
  /** The user's choice; 'system' follows the OS light/dark scheme. */
  preference: ThemePreference
  /** 'system' clears the stored choice. */
  setMode: (mode: ThemePreference) => void
  colors: ThemeColors
  fonts: ThemeFonts
}

/** Same key as the web app. */
export const THEME_KEY = 'tunepulse:theme'

const FALLBACK: Theme = { mode: 'light', preference: 'system', setMode: () => {}, colors: LIGHT, fonts: SYSTEM_FONTS }

const ThemeContext = createContext<Theme>(FALLBACK)
const ReadyContext = createContext(true)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [stored, setStored, hydrated] = usePersistentState<ThemeMode | null>(THEME_KEY, null, parseThemeMode)
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES)
  const mode = resolveThemeMode(stored, system)
  const setMode = useCallback((next: ThemePreference) => setStored(storedFromPreference(next)), [setStored])

  const value = useMemo<Theme>(
    () => ({
      mode,
      preference: preferenceFromStored(stored),
      setMode,
      colors: THEME_COLORS[mode],
      fonts: fontsLoaded ? APP_FONTS : SYSTEM_FONTS,
    }),
    [mode, stored, setMode, fontsLoaded],
  )
  const ready = hydrated && (fontsLoaded || fontError != null)

  return (
    <ReadyContext.Provider value={ready}>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </ReadyContext.Provider>
  )
}

export function useTheme(): Theme {
  return useContext(ThemeContext)
}

/** True once fonts have loaded (or failed) and the persisted mode is known. */
export function useThemeReady(): boolean {
  return useContext(ReadyContext)
}
