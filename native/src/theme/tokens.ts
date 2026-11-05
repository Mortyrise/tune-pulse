// Handoff tokens (handoff/README.md → "Design tokens") + font family names.
export type ThemeMode = 'light' | 'dark' | 'mono'

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'mono']

/** What the user chose: a fixed mode, or follow the system ('system' = nothing stored). */
export type ThemePreference = ThemeMode | 'system'

/** Handoff tokens (`--color-*`) in camelCase. */
export type ThemeColors = {
  bg: string
  paper: string
  paperDeep: string
  fg: string
  fgDim: string
  muted: string
  border: string
  borderStrong: string
  accent: string
  accentDeep: string
  accentSoft: string
  warn: string
  bad: string
  good: string
  /** Modal/sheet backdrop. */
  scrim: string
}

/** Font family names, one per loaded weight/style (RN has no variable-weight families). */
export type ThemeFonts = {
  sans: { light: string; regular: string; medium: string; semibold: string; bold: string }
  mono: { light: string; regular: string; medium: string; semibold: string }
  display: { light: string; regular: string; semibold: string; italic: string }
}

export const LIGHT: ThemeColors = {
  bg: '#EEE7D6',
  paper: '#FAF5E5',
  paperDeep: '#E4DCC4',
  fg: '#181816',
  fgDim: '#3A382F',
  muted: '#8A867A',
  border: 'rgba(24,24,22,0.08)',
  borderStrong: 'rgba(24,24,22,0.15)',
  accent: '#C4502F',
  accentDeep: '#9B3A1C',
  accentSoft: 'rgba(196,80,47,0.12)',
  warn: '#D49A2B',
  bad: '#B83A2A',
  good: '#4A7C3A',
  scrim: 'rgba(0,0,0,0.42)',
}

export const DARK: ThemeColors = {
  bg: '#0F0E0C',
  paper: '#1A1815',
  paperDeep: '#131210',
  fg: '#F4EFE2',
  fgDim: '#C6BFAE',
  muted: '#807968',
  border: 'rgba(244,239,226,0.07)',
  borderStrong: 'rgba(244,239,226,0.14)',
  accent: '#E26A3F',
  accentDeep: '#B7522D',
  accentSoft: 'rgba(226,106,63,0.16)',
  warn: '#E4B547',
  bad: '#E26452',
  good: '#7BB070',
  scrim: 'rgba(0,0,0,0.6)',
}

/** The handoff defines no mono accent-deep; the accent is already ink, so reuse it. */
export const MONO: ThemeColors = {
  bg: '#F4EFE2',
  paper: '#FBF7E9',
  paperDeep: '#ECE6D5',
  fg: '#100F0D',
  fgDim: '#2A2924',
  muted: '#7E7B70',
  border: 'rgba(16,15,13,0.08)',
  borderStrong: 'rgba(16,15,13,0.18)',
  accent: '#100F0D',
  accentDeep: '#100F0D',
  accentSoft: 'rgba(16,15,13,0.08)',
  warn: '#8C7228',
  bad: '#8C3A2A',
  good: '#325A26',
  scrim: 'rgba(16,15,13,0.42)',
}

export const THEME_COLORS: Record<ThemeMode, ThemeColors> = { light: LIGHT, dark: DARK, mono: MONO }

/** Family names = the keys passed to useFonts (see fonts.ts). */
export const APP_FONTS: ThemeFonts = {
  sans: {
    light: 'Inter_300Light',
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  mono: {
    light: 'JetBrainsMono_300Light',
    regular: 'JetBrainsMono_400Regular',
    medium: 'JetBrainsMono_500Medium',
    semibold: 'JetBrainsMono_600SemiBold',
  },
  display: {
    light: 'Fraunces_300Light',
    regular: 'Fraunces_400Regular',
    semibold: 'Fraunces_600SemiBold',
    italic: 'Fraunces_400Regular_Italic',
  },
}

export const SYSTEM_FONTS: ThemeFonts = {
  sans: { light: 'System', regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
  mono: { light: 'monospace', regular: 'monospace', medium: 'monospace', semibold: 'monospace' },
  display: { light: 'serif', regular: 'serif', semibold: 'serif', italic: 'serif' },
}

export function parseThemeMode(value: unknown): ThemeMode | undefined {
  return value === 'light' || value === 'dark' || value === 'mono' ? value : undefined
}

/** Explicit choice wins; otherwise follow the system (light unless it says dark). */
export function resolveThemeMode(stored: ThemeMode | null, system: string | null | undefined): ThemeMode {
  return stored ?? (system === 'dark' ? 'dark' : 'light')
}

export function preferenceFromStored(stored: ThemeMode | null): ThemePreference {
  return stored ?? 'system'
}

export function storedFromPreference(preference: ThemePreference): ThemeMode | null {
  return preference === 'system' ? null : preference
}

/** Status bar content style for a mode. */
export function statusBarStyle(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'dark' ? 'light' : 'dark'
}
