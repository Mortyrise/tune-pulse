import { useCallback, useEffect, useState } from 'react'
import type { MetronomeConfig } from '../audio/metronomeScheduler'

const STORAGE_KEY = 'tunepulse:metronome-patterns'

export type SavedPattern = {
  id: string
  name: string
  createdAt: number
  config: MetronomeConfig
}

function readStorage(): SavedPattern[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as SavedPattern[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStorage(patterns: SavedPattern[]) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
  } catch {
    // localStorage may be full or disabled — silently ignore.
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function useSavedPatterns() {
  const [patterns, setPatterns] = useState<SavedPattern[]>(() => readStorage())

  useEffect(() => {
    writeStorage(patterns)
  }, [patterns])

  const save = useCallback((name: string, config: MetronomeConfig): SavedPattern => {
    const pattern: SavedPattern = {
      id: generateId(),
      name: name.trim() || 'Untitled',
      createdAt: Date.now(),
      config,
    }
    setPatterns((current) => [pattern, ...current])
    return pattern
  }, [])

  const remove = useCallback((id: string) => {
    setPatterns((current) => current.filter((p) => p.id !== id))
  }, [])

  const rename = useCallback((id: string, name: string) => {
    setPatterns((current) =>
      current.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
    )
  }, [])

  return { patterns, save, remove, rename }
}
