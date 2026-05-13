import { useEffect, useState } from 'react'

const ACCENT_DURATION_MS = 1200
const REGULAR_DURATION_MS = 950

export type PulseRingsProps = {
  /** Increments every beat. Re-render with same value won't trigger a new ring. */
  tickId: number | null
  isRunning: boolean
  isAccent: boolean
  size?: number
}

type Ring = {
  id: string
  accent: boolean
}

export function PulseRings({ tickId, isRunning, isAccent, size = 260 }: PulseRingsProps) {
  const [rings, setRings] = useState<Ring[]>([])

  useEffect(() => {
    if (!isRunning || tickId === null) {
      return
    }
    const id = `${tickId}-${Math.random().toString(36).slice(2, 7)}`
    setRings((current) => [...current.slice(-3), { id, accent: isAccent }])
    const handle = window.setTimeout(() => {
      setRings((current) => current.filter((r) => r.id !== id))
    }, ACCENT_DURATION_MS)
    return () => {
      window.clearTimeout(handle)
    }
  }, [tickId, isRunning, isAccent])

  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
      {rings.map((ring) => (
        <span
          key={ring.id}
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            border: `${ring.accent ? 2 : 1}px solid var(--color-accent)`,
            opacity: ring.accent ? 0.7 : 0.4,
            animation: `pg-ring-expand ${
              ring.accent ? ACCENT_DURATION_MS : REGULAR_DURATION_MS
            }ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
          }}
        />
      ))}
    </div>
  )
}
