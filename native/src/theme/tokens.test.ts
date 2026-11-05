import { describe, expect, it } from 'vitest'
import {
  LIGHT,
  THEME_COLORS,
  THEME_MODES,
  parseThemeMode,
  preferenceFromStored,
  resolveThemeMode,
  statusBarStyle,
  storedFromPreference,
} from './tokens'

describe('theme tokens', () => {
  it('every mode defines every token', () => {
    const keys = Object.keys(LIGHT).sort()
    for (const mode of THEME_MODES) {
      expect(Object.keys(THEME_COLORS[mode]).sort()).toEqual(keys)
      for (const v of Object.values(THEME_COLORS[mode])) expect(v).toMatch(/^(#|rgba\()/)
    }
  })

  it('resolves the mode: stored wins, else system, else light', () => {
    expect(resolveThemeMode('mono', 'dark')).toBe('mono')
    expect(resolveThemeMode(null, 'dark')).toBe('dark')
    expect(resolveThemeMode(null, 'light')).toBe('light')
    expect(resolveThemeMode(null, null)).toBe('light')
    expect(resolveThemeMode(null, 'unspecified')).toBe('light')
  })

  it('parses stored modes and picks the status bar style', () => {
    expect(parseThemeMode('dark')).toBe('dark')
    expect(parseThemeMode('blue')).toBeUndefined()
    expect(statusBarStyle('dark')).toBe('light')
    expect(statusBarStyle('mono')).toBe('dark')
  })

  it('maps preference <-> stored and resolves "system" back to the OS scheme', () => {
    expect(storedFromPreference('system')).toBeNull()
    expect(storedFromPreference('mono')).toBe('mono')
    expect(preferenceFromStored(null)).toBe('system')
    expect(preferenceFromStored('dark')).toBe('dark')
    // pick dark explicitly on a light phone, then go back to system
    expect(resolveThemeMode(storedFromPreference('dark'), 'light')).toBe('dark')
    expect(resolveThemeMode(storedFromPreference('system'), 'light')).toBe('light')
    expect(resolveThemeMode(storedFromPreference('system'), 'dark')).toBe('dark')
  })
})
