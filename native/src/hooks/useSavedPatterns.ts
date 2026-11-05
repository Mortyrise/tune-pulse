import { useCallback } from 'react'
import { sanitizeConfig, type MetronomeConfig } from '../audio/metronome'
import { usePersistentState } from '../settings'

export const SAVED_PATTERNS_KEY = 'tunepulse:metronome-patterns'

export type SavedPattern = {
  id: string
  name: string
  createdAt: number
  config: MetronomeConfig
}

/** Keep well-formed entries only; configs are sanitized. */
export function sanitizePatterns(raw: unknown): SavedPattern[] {
  if (!Array.isArray(raw)) return []
  const out: SavedPattern[] = []
  for (const p of raw) {
    if (typeof p !== 'object' || p === null) continue
    const { id, name, createdAt, config } = p as Record<string, unknown>
    if (typeof id !== 'string' || typeof name !== 'string') continue
    out.push({
      id,
      name,
      createdAt: typeof createdAt === 'number' ? createdAt : 0,
      config: sanitizeConfig(config),
    })
  }
  return out
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function useSavedPatterns() {
  const [patterns, setPatterns, hydrated] = usePersistentState<SavedPattern[]>(
    SAVED_PATTERNS_KEY,
    [],
    sanitizePatterns,
  )

  const save = useCallback(
    (name: string, config: MetronomeConfig): SavedPattern => {
      const pattern: SavedPattern = {
        id: generateId(),
        name: name.trim() || 'Untitled',
        createdAt: Date.now(),
        config,
      }
      setPatterns((current) => [pattern, ...current])
      return pattern
    },
    [setPatterns],
  )

  const remove = useCallback(
    (id: string) => setPatterns((current) => current.filter((p) => p.id !== id)),
    [setPatterns],
  )

  const rename = useCallback(
    (id: string, name: string) =>
      setPatterns((current) => current.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p))),
    [setPatterns],
  )

  return { patterns, hydrated, save, remove, rename }
}
