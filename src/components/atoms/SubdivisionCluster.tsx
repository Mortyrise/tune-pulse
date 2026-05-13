import type { Subdivision } from '../../audio/metronomeScheduler'

export type SubdivisionClusterProps = {
  count: Subdivision
  isActive: boolean
  subIndex: number
}

export function SubdivisionCluster({ count, isActive, subIndex }: SubdivisionClusterProps) {
  const dots = []
  for (let i = 0; i < count; i++) {
    const lit = isActive && subIndex === i
    dots.push(
      <span
        key={i}
        className="rounded-full transition-transform"
        style={{
          width: 3.5,
          height: 3.5,
          background: lit ? 'var(--color-accent)' : 'var(--color-fg-dim)',
          opacity: lit ? 1 : count === 1 ? 0.9 : 0.55,
          transform: lit ? 'scale(1.4)' : 'scale(1)',
          transitionDuration: '80ms',
        }}
      />,
    )
  }
  return <div className="flex min-h-2 items-center justify-center gap-[3px]">{dots}</div>
}
