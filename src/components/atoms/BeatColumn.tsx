import type { Subdivision } from '../../audio/metronomeScheduler'
import { SubdivisionCluster } from './SubdivisionCluster'

export type BeatColumnProps = {
  beat: number
  isAccent: boolean
  subdivision: Subdivision
  currentBeat: number
  currentSub: number
  isRunning: boolean
  inCountIn: boolean
  onToggleAccent: () => void
  onCycleSubdivision: () => void
}

export function BeatColumn({
  beat,
  isAccent,
  subdivision,
  currentBeat,
  currentSub,
  isRunning,
  inCountIn,
  onToggleAccent,
  onCycleSubdivision,
}: BeatColumnProps) {
  const isCurrent = isRunning && beat === currentBeat && !inCountIn

  const accentBackground = isAccent
    ? isCurrent
      ? 'var(--color-accent)'
      : 'var(--color-fg)'
    : isCurrent
      ? 'var(--color-accent-soft)'
      : 'transparent'

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onToggleAccent}
        aria-pressed={isAccent}
        aria-label={`Toggle accent on beat ${beat}`}
        className="block w-full max-w-[30px] rounded transition-all duration-100"
        style={{
          height: 11,
          background: accentBackground,
          border: isAccent ? '0.5px solid transparent' : '0.5px solid var(--color-border-strong)',
        }}
      />
      <span
        className="font-mono tabular-nums transition-colors"
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: isCurrent ? 'var(--color-accent)' : 'var(--color-muted)',
          transitionDuration: '80ms',
        }}
      >
        {beat}
      </span>
      <button
        type="button"
        onClick={onCycleSubdivision}
        aria-label={`Cycle subdivision for beat ${beat}`}
        className="flex flex-col items-center gap-[3px] rounded-lg px-1.5 py-1"
        style={{
          minWidth: 36,
          background: 'var(--color-paper)',
          border: '0.5px solid var(--color-border)',
        }}
      >
        <SubdivisionCluster count={subdivision} isActive={isCurrent} subIndex={currentSub} />
        <span
          className="font-mono"
          style={{
            fontSize: 8.5,
            color: 'var(--color-muted)',
            letterSpacing: '0.04em',
          }}
        >
          ×{subdivision}
        </span>
      </button>
    </div>
  )
}
