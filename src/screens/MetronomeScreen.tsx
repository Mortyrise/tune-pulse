import { Minus, Pause, Play, Plus } from 'lucide-react'
import { MAX_BPM, MIN_BPM, useMetronome } from '../hooks/useMetronome'

export function MetronomeScreen() {
  const { config, isRunning, activeBeat, toggle, setBpm } = useMetronome()
  const currentBeat = activeBeat?.beat ?? 0

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col items-center justify-between px-6 py-8">
      <header className="text-center">
        <p className="text-sm uppercase tracking-widest text-[color:var(--color-muted)]">
          Metronome
        </p>
        <p className="mt-1 text-xs text-[color:var(--color-muted)]">
          {config.numerator}/{config.denominator}
        </p>
      </header>

      <div className="flex flex-col items-center gap-2">
        <div className="font-mono text-8xl font-light tabular-nums">{config.bpm}</div>
        <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
          BPM
        </div>
      </div>

      <BeatDots count={config.numerator} active={currentBeat} accents={config.beats.accents} />

      <div className="flex w-full flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setBpm(config.bpm - 1)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-border)]"
            aria-label="Decrease BPM"
          >
            <Minus className="h-5 w-5" />
          </button>
          <input
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            value={config.bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="flex-1 accent-[color:var(--color-accent)]"
            aria-label="BPM"
          />
          <button
            type="button"
            onClick={() => setBpm(config.bpm + 1)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-border)]"
            aria-label="Increase BPM"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={toggle}
          className="flex h-16 w-full items-center justify-center gap-2 rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-bg)] transition active:scale-[0.98]"
        >
          {isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          <span className="text-base font-medium">{isRunning ? 'Stop' : 'Start'}</span>
        </button>
      </div>
    </div>
  )
}

function BeatDots({
  count,
  active,
  accents,
}: {
  count: number
  active: number
  accents: number[]
}) {
  return (
    <div className="flex items-center gap-3">
      {Array.from({ length: count }, (_, i) => {
        const beat = i + 1
        const isActive = beat === active
        const isAccent = accents.includes(beat)
        const size = isAccent ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'
        return (
          <div
            key={beat}
            className={`${size} rounded-full transition-colors duration-75`}
            style={{
              backgroundColor: isActive
                ? 'var(--color-accent)'
                : 'var(--color-border)',
            }}
          />
        )
      })}
    </div>
  )
}
