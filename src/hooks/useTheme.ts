import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'mono'

export const THEMES: Theme[] = ['light', 'dark', 'mono']

const STORAGE_KEY = 'tunepulse:theme'

function isValidTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'mono'
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (isValidTheme(stored)) {
    return stored
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const cycle = useCallback(() => {
    setTheme((current) => {
      const index = THEMES.indexOf(current)
      return THEMES[(index + 1) % THEMES.length]
    })
  }, [])

  return { theme, setTheme, cycle }
}
