import { useState } from 'react'
import {
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Minus,
  Pause,
  Play,
  Plus,
  Vibrate,
  Volume2,
  X,
} from 'lucide-react'
import { MAX_BPM, MIN_BPM, useMetronome } from '../hooks/useMetronome'
import { useSavedPatterns, type SavedPattern } from '../hooks/useSavedPatterns'
import { useTapTempo } from '../hooks/useTapTempo'
import {
  DENOMINATOR_OPTIONS,
  MAX_NUMERATOR,
  MIN_NUMERATOR,
  SUBDIVISION_OPTIONS,
  type CountInBars,
  type Denominator,
  type MetronomeConfig,
  type Subdivision,
} from '../audio/metronomeScheduler'

const COUNT_IN_OPTIONS: { value: CountInBars; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 1, label: '1 bar' },
  { value: 2, label: '2 bars' },
]

export function MetronomeScreen() {
  const {
    config,
    isRunning,
    activeBeat,
    toggle,
    setBpm,
    setCountInBars,
    setNumerator,
    setDenominator,
    toggleAccent,
    setSubdivision,
    setHapticMode,
    applyConfig,
  } = useMetronome()
  const { tap } = useTapTempo({ onBpm: setBpm })
  const { patterns, save, remove } = useSavedPatterns()

  const inCountIn = activeBeat?.phase === 'count-in'
  const currentBeat = activeBeat?.beat ?? 0

  const handleSave = () => {
    const suggested = `${config.bpm} bpm · ${config.numerator}/${config.denominator}`
    const name = window.prompt('Pattern name', suggested)
    if (name === null) {
      return
    }
    save(name, config)
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-6">
      <header className="text-center">
        <p className="text-sm uppercase tracking-widest text-[color:var(--color-muted)]">
          Metronome
        </p>
        {inCountIn && (
          <p className="mt-1 text-xs uppercase tracking-widest text-[color:var(--color-warn)]">
            Count-in
          </p>
        )}
      </header>

      <TimeSignature
        numerator={config.numerator}
        denominator={config.denominator}
        onNumeratorChange={setNumerator}
        onDenominatorChange={setDenominator}
      />

      <div className="flex flex-col items-center gap-2">
        <div className="font-mono text-7xl font-light tabular-nums">{config.bpm}</div>
        <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
          BPM
        </div>
      </div>

      <PatternEditor
        numerator={config.numerator}
        accents={config.beats.accents}
        subdivisions={config.beats.subdivisions}
        currentBeat={currentBeat}
        inCountIn={inCountIn}
        onToggleAccent={toggleAccent}
        onSubdivisionChange={setSubdivision}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={tap}
          className="flex h-12 min-w-16 items-center justify-center rounded-full border border-[color:var(--color-border)] text-xs font-semibold uppercase tracking-widest transition active:scale-95"
          aria-label="Tap tempo"
        >
          Tap
        </button>
        <CountInSelector value={config.countInBars} onChange={setCountInBars} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setHapticMode(!config.hapticMode)}
          aria-pressed={config.hapticMode}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[color:var(--color-border)] text-xs font-medium uppercase tracking-widest transition"
          style={{
            backgroundColor: config.hapticMode ? 'var(--color-fg)' : 'transparent',
            color: config.hapticMode ? 'var(--color-bg)' : 'var(--color-muted)',
          }}
        >
          {config.hapticMode ? <Vibrate className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {config.hapticMode ? 'Haptic' : 'Audio'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[color:var(--color-border)] text-xs font-medium uppercase tracking-widest"
          aria-label="Save pattern"
        >
          <BookmarkPlus className="h-4 w-4" />
          Save preset
        </button>
      </div>

      {patterns.length > 0 && (
        <PatternsList patterns={patterns} onLoad={applyConfig} onDelete={remove} />
      )}

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
  )
}

function TimeSignature({
  numerator,
  denominator,
  onNumeratorChange,
  onDenominatorChange,
}: {
  numerator: number
  denominator: Denominator
  onNumeratorChange: (value: number) => void
  onDenominatorChange: (value: Denominator) => void
}) {
  const cycleDenominator = (direction: 1 | -1) => {
    const index = DENOMINATOR_OPTIONS.indexOf(denominator)
    const nextIndex = (index + direction + DENOMINATOR_OPTIONS.length) % DENOMINATOR_OPTIONS.length
    onDenominatorChange(DENOMINATOR_OPTIONS[nextIndex])
  }

  return (
    <div className="flex items-center justify-center gap-4 text-2xl font-mono tabular-nums">
      <Stepper
        value={numerator}
        min={MIN_NUMERATOR}
        max={MAX_NUMERATOR}
        onChange={onNumeratorChange}
        ariaLabel="Beats per bar"
      />
      <span className="text-[color:var(--color-muted)]">/</span>
      <Stepper
        value={denominator}
        min={DENOMINATOR_OPTIONS[0]}
        max={DENOMINATOR_OPTIONS[DENOMINATOR_OPTIONS.length - 1]}
        onChange={(_) => {}}
        onDecrement={() => cycleDenominator(-1)}
        onIncrement={() => cycleDenominator(1)}
        ariaLabel="Beat note value"
      />
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange,
  onIncrement,
  onDecrement,
  ariaLabel,
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  onIncrement?: () => void
  onDecrement?: () => void
  ariaLabel: string
}) {
  const inc = onIncrement ?? (() => onChange(value + 1))
  const dec = onDecrement ?? (() => onChange(value - 1))
  return (
    <div className="flex flex-col items-center" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        className="text-[color:var(--color-muted)] transition hover:text-[color:var(--color-fg)] disabled:opacity-30"
        aria-label={`Increase ${ariaLabel}`}
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <span className="min-w-8 text-center">{value}</span>
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        className="text-[color:var(--color-muted)] transition hover:text-[color:var(--color-fg)] disabled:opacity-30"
        aria-label={`Decrease ${ariaLabel}`}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  )
}

function PatternEditor({
  numerator,
  accents,
  subdivisions,
  currentBeat,
  inCountIn,
  onToggleAccent,
  onSubdivisionChange,
}: {
  numerator: number
  accents: number[]
  subdivisions: Subdivision[]
  currentBeat: number
  inCountIn: boolean
  onToggleAccent: (beat: number) => void
  onSubdivisionChange: (beatIndex: number, subdivision: Subdivision) => void
}) {
  const activeColor = inCountIn ? 'var(--color-warn)' : 'var(--color-accent)'
  const gap = numerator >= 8 ? 'gap-1.5' : 'gap-3'

  const cycleSubdivision = (beatIndex: number) => {
    const current = subdivisions[beatIndex] ?? 1
    const idx = SUBDIVISION_OPTIONS.indexOf(current)
    const next = SUBDIVISION_OPTIONS[(idx + 1) % SUBDIVISION_OPTIONS.length]
    onSubdivisionChange(beatIndex, next)
  }

  return (
    <div className={`flex items-center justify-center ${gap}`}>
      {Array.from({ length: numerator }, (_, i) => {
        const beat = i + 1
        const isActive = beat === currentBeat
        const isAccented = accents.includes(beat) && !inCountIn
        const subdivision = subdivisions[i] ?? 1

        return (
          <div key={beat} className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleAccent(beat)}
              aria-label={`Toggle accent on beat ${beat}`}
              aria-pressed={isAccented}
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition"
              style={{
                backgroundColor: isAccented ? 'var(--color-fg)' : 'transparent',
                color: isAccented ? 'var(--color-bg)' : 'var(--color-muted)',
                border: isAccented ? 'none' : '1px solid var(--color-border)',
              }}
            >
              A
            </button>
            <div
              className={`rounded-full transition-colors duration-75 ${isAccented ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'}`}
              style={{
                backgroundColor: isActive ? activeColor : 'var(--color-border)',
              }}
            />
            <button
              type="button"
              onClick={() => cycleSubdivision(i)}
              aria-label={`Beat ${beat} subdivision`}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--color-border)] text-xs font-mono tabular-nums text-[color:var(--color-muted)] transition hover:text-[color:var(--color-fg)]"
            >
              {subdivision}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function CountInSelector({
  value,
  onChange,
}: {
  value: CountInBars
  onChange: (bars: CountInBars) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Count-in"
      className="flex flex-1 items-center rounded-full border border-[color:var(--color-border)] p-1"
    >
      {COUNT_IN_OPTIONS.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className="flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition"
            style={{
              backgroundColor: selected ? 'var(--color-fg)' : 'transparent',
              color: selected ? 'var(--color-bg)' : 'var(--color-muted)',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function PatternsList({
  patterns,
  onLoad,
  onDelete,
}: {
  patterns: SavedPattern[]
  onLoad: (config: MetronomeConfig) => void
  onDelete: (id: string) => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const handleDeleteClick = (id: string) => {
    if (confirmingDelete === id) {
      onDelete(id)
      setConfirmingDelete(null)
    } else {
      setConfirmingDelete(id)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
        Saved presets
      </p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {patterns.map((pattern) => (
          <div
            key={pattern.id}
            className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-border)] pl-3 pr-1"
          >
            <button
              type="button"
              onClick={() => onLoad(pattern.config)}
              className="py-1.5 text-xs font-medium"
            >
              {pattern.name}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteClick(pattern.id)}
              aria-label={`Delete ${pattern.name}`}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--color-muted)] transition"
              style={{
                backgroundColor:
                  confirmingDelete === pattern.id ? 'var(--color-bad)' : 'transparent',
                color:
                  confirmingDelete === pattern.id
                    ? 'var(--color-bg)'
                    : 'var(--color-muted)',
              }}
              onBlur={() => setConfirmingDelete(null)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
