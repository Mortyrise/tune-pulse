import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  Bookmark,
  BookmarkPlus,
  Hand,
  Pause,
  Play,
  Settings as SettingsIcon,
  Vibrate,
  Volume2,
  X,
} from 'lucide-react'
import { BeatColumn } from '../components/atoms/BeatColumn'
import { BottomSheet } from '../components/atoms/BottomSheet'
import { Chip } from '../components/atoms/Chip'
import { Dial } from '../components/atoms/Dial'
import { PulseRings } from '../components/atoms/PulseRings'
import { MAX_BPM, MIN_BPM, useMetronome } from '../hooks/useMetronome'
import { useSavedPatterns, type SavedPattern } from '../hooks/useSavedPatterns'
import { useTapTempo } from '../hooks/useTapTempo'
import { GROOVES_LIBRARY, type Groove } from '../lib/grooves'
import { getTempoCharacter } from '../lib/tempo'
import {
  DENOMINATOR_OPTIONS,
  type CountInBars,
  type Denominator,
  type MetronomeConfig,
} from '../audio/metronomeScheduler'

const NUMERATOR_CHOICES = [2, 3, 4, 5, 6, 7, 8, 9, 12] as const

const NOTE_LABEL_BY_DENOM: Record<Denominator, string> = {
  2: '𝅗𝅥',
  4: '♩',
  8: '♪',
  16: '𝅘𝅥𝅯',
}

type SheetKind = 'signature' | 'grooves' | null

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function nextCountIn(current: CountInBars): CountInBars {
  if (current === 0) {
    return 1
  }
  if (current === 1) {
    return 2
  }
  return 0
}

function countInLabel(value: CountInBars): string {
  if (value === 0) {
    return 'off'
  }
  if (value === 1) {
    return '1 bar'
  }
  return '2 bars'
}

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
  const { patterns: savedPatterns, save, remove } = useSavedPatterns()

  const [sheet, setSheet] = useState<SheetKind>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isRunning) {
      setElapsedMs(0)
      startedAtRef.current = null
      return
    }
    startedAtRef.current = Date.now()
    const id = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current)
      }
    }, 250)
    return () => {
      window.clearInterval(id)
    }
  }, [isRunning])

  const inCountIn = activeBeat?.phase === 'count-in'
  const currentBeat = activeBeat?.beat ?? 0
  const currentSub = activeBeat?.subdivision ?? 0
  const isAccentBeat = activeBeat?.isAccent ?? false
  const tickId = activeBeat ? activeBeat.time : null

  const patternBarIndex = activeBeat
    ? Math.max(0, activeBeat.barIndex - config.countInBars)
    : 0
  const displayedBar = isRunning && !inCountIn ? patternBarIndex + 1 : 0

  const tempo = getTempoCharacter(config.bpm)
  const beatPeriodMs = 60_000 / config.bpm

  const applyGroove = (groove: Groove) => {
    applyConfig({
      ...config,
      bpm: groove.bpm,
      numerator: groove.numerator,
      denominator: groove.denominator,
      beats: {
        accents: groove.accents,
        subdivisions: groove.subdivisions,
      },
    })
    setSheet(null)
  }

  const applySavedPattern = (pattern: SavedPattern) => {
    applyConfig(pattern.config)
    setSheet(null)
  }

  const handleSavePattern = () => {
    const suggestion = `${config.bpm} bpm · ${config.numerator}/${config.denominator}`
    const name = window.prompt('Save groove as', suggestion)
    if (name === null) {
      return
    }
    save(name, config)
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-3.5 px-6 pb-6 pt-3">
      <div className="pg-topbar">
        <div className="pg-brand">
          <span
            className="pg-brand-dot"
            style={{
              animationDuration: isRunning ? `${beatPeriodMs * 2}ms` : '2s',
            }}
          />
          <span>pulse·groove</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="pg-section-label">Metronome</span>
          <Link
            to="/settings"
            aria-label="Open settings"
            className="text-[color:var(--color-muted)] transition hover:text-[color:var(--color-fg)]"
          >
            <SettingsIcon size={14} strokeWidth={1.6} />
          </Link>
        </div>
      </div>

      <div className="flex items-baseline gap-2.5 pb-1">
        <span
          className="pg-display italic"
          style={{
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: '-0.01em',
            color: 'var(--color-fg)',
          }}
        >
          {tempo.name}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: 'var(--color-muted)',
            letterSpacing: '0.04em',
          }}
        >
          · {tempo.meaning}
        </span>
      </div>

      <div
        className="relative flex items-center justify-center"
        style={{ height: 268, margin: '4px 0 8px' }}
      >
        <PulseRings tickId={tickId} isRunning={isRunning} isAccent={isAccentBeat} size={244} />
        <Dial
          value={config.bpm}
          min={MIN_BPM}
          max={MAX_BPM}
          onChange={setBpm}
          size={260}
          isRunning={isRunning}
        >
          <div
            className="pg-display tabular-nums"
            style={{
              fontSize: 86,
              fontWeight: 300,
              lineHeight: 1,
              color: 'var(--color-fg)',
              letterSpacing: '-0.045em',
            }}
          >
            {config.bpm}
          </div>
          <div
            className="mt-1 flex items-center gap-1.5 font-mono uppercase"
            style={{
              fontSize: 9.5,
              color: 'var(--color-muted)',
              letterSpacing: '0.22em',
            }}
          >
            <span>BPM</span>
            <span style={{ opacity: 0.45 }}>·</span>
            <span style={{ letterSpacing: '0.12em' }}>drag</span>
          </div>
          <button
            type="button"
            className="pg-no-drag mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 pointer-events-auto"
            onClick={() => setSheet('signature')}
            style={{
              background: 'var(--color-paper)',
              border: '0.5px solid var(--color-border)',
              color: 'var(--color-fg)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}
          >
            <span>
              {config.numerator}/{config.denominator}
            </span>
            <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>
              {NOTE_LABEL_BY_DENOM[config.denominator]}
            </span>
          </button>
        </Dial>
      </div>

      <div className="pg-card">
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <span className="pg-section-label">Bar pattern</span>
          <span
            className="pg-numeric"
            style={{ fontSize: 9.5, color: 'var(--color-muted)', letterSpacing: '0.06em' }}
          >
            tap · cycle clicks
          </span>
        </div>
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="flex items-end gap-1">
            {Array.from({ length: config.numerator }).map((_, i) => (
              <BeatColumn
                key={i}
                beat={i + 1}
                isAccent={config.beats.accents.includes(i + 1)}
                subdivision={config.beats.subdivisions[i] ?? 1}
                currentBeat={currentBeat}
                currentSub={currentSub}
                isRunning={isRunning}
                inCountIn={inCountIn}
                onToggleAccent={() => toggleAccent(i + 1)}
                onCycleSubdivision={() => {
                  const current = config.beats.subdivisions[i] ?? 1
                  const next = ([1, 2, 3, 4] as const)[
                    (([1, 2, 3, 4] as const).indexOf(current) + 1) % 4
                  ]
                  setSubdivision(i, next)
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="pg-session">
        <div className="flex items-center gap-3">
          <span>
            BAR <strong>{String(displayedBar).padStart(3, '0')}</strong>
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{formatElapsed(elapsedMs)}</span>
        </div>
        <div className="flex items-center gap-2">
          {inCountIn && (
            <span style={{ color: 'var(--color-warn)' }}>● count-in</span>
          )}
          {!inCountIn && isRunning && (
            <span style={{ color: 'var(--color-good)' }}>● live</span>
          )}
          {!isRunning && <span style={{ opacity: 0.55 }}>○ idle</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip onClick={tap}>
          <Hand size={12} strokeWidth={1.8} />
          Tap tempo
        </Chip>
        <Chip
          active={config.countInBars > 0}
          onClick={() => setCountInBars(nextCountIn(config.countInBars))}
        >
          Count-in · {countInLabel(config.countInBars)}
        </Chip>
        <Chip
          active={config.hapticMode}
          onClick={() => setHapticMode(!config.hapticMode)}
        >
          {config.hapticMode ? <Vibrate size={11} strokeWidth={1.8} /> : <Volume2 size={11} strokeWidth={1.8} />}
          {config.hapticMode ? 'Haptic' : 'Audio'}
        </Chip>
        <Chip onClick={() => setSheet('grooves')}>
          <Bookmark size={11} strokeWidth={1.8} />
          Grooves
        </Chip>
      </div>

      <div className="mt-auto pt-2">
        <button
          type="button"
          onClick={toggle}
          className={`pg-play ${isRunning ? 'is-running' : ''}`}
        >
          {isRunning ? <Pause size={14} /> : <Play size={14} />}
          {isRunning ? 'Stop' : 'Start groove'}
        </button>
      </div>

      <BottomSheet open={sheet === 'signature'} onClose={() => setSheet(null)} title="Time signature">
        <SignatureSheetContent
          numerator={config.numerator}
          denominator={config.denominator}
          onNumeratorChange={setNumerator}
          onDenominatorChange={setDenominator}
        />
      </BottomSheet>

      <BottomSheet open={sheet === 'grooves'} onClose={() => setSheet(null)} title="Grooves">
        <GroovesSheetContent
          activeConfig={config}
          onApplyGroove={applyGroove}
          savedPatterns={savedPatterns}
          onApplySavedPattern={applySavedPattern}
          onSaveCurrent={handleSavePattern}
          onDeleteSavedPattern={remove}
        />
      </BottomSheet>
    </div>
  )
}

function SignatureSheetContent({
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
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="pg-section-label mb-2.5">Beats per bar</p>
        <div className="flex flex-wrap gap-1.5">
          {NUMERATOR_CHOICES.map((n) => (
            <Chip
              key={n}
              active={numerator === n}
              onClick={() => onNumeratorChange(n)}
              style={{ minWidth: 40, justifyContent: 'center' }}
            >
              {n}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="pg-section-label mb-2.5">Note value</p>
        <div className="flex flex-wrap gap-1.5">
          {DENOMINATOR_OPTIONS.map((d) => (
            <Chip
              key={d}
              active={denominator === d}
              onClick={() => onDenominatorChange(d)}
              style={{ minWidth: 56, justifyContent: 'center', gap: 8 }}
            >
              <span>{d}</span>
              <span style={{ opacity: 0.6 }}>{NOTE_LABEL_BY_DENOM[d]}</span>
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}

function GroovesSheetContent({
  activeConfig,
  onApplyGroove,
  savedPatterns,
  onApplySavedPattern,
  onSaveCurrent,
  onDeleteSavedPattern,
}: {
  activeConfig: MetronomeConfig
  onApplyGroove: (groove: Groove) => void
  savedPatterns: SavedPattern[]
  onApplySavedPattern: (pattern: SavedPattern) => void
  onSaveCurrent: () => void
  onDeleteSavedPattern: (id: string) => void
}) {
  return (
    <div className="flex max-h-[420px] flex-col gap-5 overflow-y-auto">
      <section>
        <p className="pg-section-label mb-2">Library</p>
        <ul className="flex flex-col">
          {GROOVES_LIBRARY.map((groove) => (
            <li key={groove.id}>
              <button
                type="button"
                onClick={() => onApplyGroove(groove)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                style={{ borderBottom: '0.5px solid var(--color-border)' }}
              >
                <div className="flex flex-col items-start gap-1">
                  <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-fg)' }}>
                    {groove.name}
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: 10.5, color: 'var(--color-muted)', letterSpacing: '0.04em' }}
                  >
                    {groove.hint}
                  </span>
                </div>
                <span
                  className="pg-numeric whitespace-nowrap"
                  style={{ fontSize: 11, color: 'var(--color-muted)' }}
                >
                  {groove.bpm} · {groove.numerator}/{groove.denominator}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="pg-section-label">My grooves</p>
          <button
            type="button"
            onClick={onSaveCurrent}
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--color-accent)' }}
          >
            <BookmarkPlus size={12} strokeWidth={1.8} />
            Save current
          </button>
        </div>
        {savedPatterns.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            Nothing saved yet. Configure the metronome and tap{' '}
            <span style={{ color: 'var(--color-accent)' }}>Save current</span>.
          </p>
        ) : (
          <ul className="flex flex-col">
            {savedPatterns.map((pattern) => (
              <li key={pattern.id}>
                <div
                  className="flex items-center justify-between gap-3 py-2.5"
                  style={{ borderBottom: '0.5px solid var(--color-border)' }}
                >
                  <button
                    type="button"
                    onClick={() => onApplySavedPattern(pattern)}
                    className="flex flex-1 flex-col items-start gap-1 text-left"
                  >
                    <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-fg)' }}>
                      {pattern.name}
                    </span>
                    <span
                      className="pg-numeric"
                      style={{ fontSize: 10.5, color: 'var(--color-muted)' }}
                    >
                      {pattern.config.bpm} · {pattern.config.numerator}/{pattern.config.denominator}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSavedPattern(pattern.id)}
                    aria-label={`Delete ${pattern.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    <X size={14} strokeWidth={1.8} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p
        className="font-mono"
        style={{ fontSize: 9.5, color: 'var(--color-muted)', letterSpacing: '0.08em' }}
      >
        Current: {activeConfig.bpm} BPM · {activeConfig.numerator}/{activeConfig.denominator}
      </p>
    </div>
  )
}
