import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  Check,
  ChevronRight,
  Mic,
  MicOff,
  RefreshCw,
  Settings as SettingsIcon,
} from 'lucide-react'
import { BottomSheet } from '../components/atoms/BottomSheet'
import { CentsRing } from '../components/atoms/CentsRing'
import { Chip } from '../components/atoms/Chip'
import { HistoryStrip, type HistorySample } from '../components/atoms/HistoryStrip'
import { useTuner, type TunerError } from '../hooks/useTuner'
import {
  REFERENCE_A4_PRESETS,
  useTunerSettings,
} from '../hooks/useTunerSettings'
import {
  formatNoteName,
  frequencyToNote,
  midiToFrequency,
  octaveFromMidi,
  splitNoteName,
  type DetectedNote,
} from '../lib/notes'
import {
  INSTRUMENTS,
  getInstrument,
  type Instrument,
  type InstrumentString,
} from '../lib/instruments'
import type { PitchSample } from '../audio/pitchDetector'

const STICKY_HOLD_MS = 1500
const CONFIRM_HOLD_MS = 1500
const HISTORY_MAX = 12
const HISTORY_THROTTLE_MS = 800

type SheetKind = 'reference' | 'instrument' | null

type ClosestStringMatch = {
  index: number
  string: InstrumentString
  semitoneDelta: number
}

function getNarrative(cents: number | null, active: boolean): string {
  if (!active || cents === null) {
    return '—'
  }
  const abs = Math.abs(cents)
  if (abs <= 5) {
    return 'In tune'
  }
  if (abs <= 12) {
    return cents > 0 ? 'Sharp · ease back' : 'Flat · push up'
  }
  if (abs <= 30) {
    return cents > 0 ? 'Sharp — keep loosening' : 'Flat — keep tightening'
  }
  return cents > 0 ? 'Very sharp' : 'Very flat'
}

function centsColorVar(cents: number, inTuneCents: number, nearCents: number): string {
  const abs = Math.abs(cents)
  if (abs <= inTuneCents) {
    return 'var(--color-good)'
  }
  if (abs <= nearCents) {
    return 'var(--color-warn)'
  }
  return 'var(--color-bad)'
}

function useStickySample(sample: PitchSample | null): PitchSample | null {
  const [display, setDisplay] = useState<PitchSample | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (sample && sample.frequency > 0) {
      setDisplay(sample)
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
      timerRef.current = window.setTimeout(() => {
        setDisplay(null)
        timerRef.current = null
      }, STICKY_HOLD_MS)
    }
  }, [sample])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  return display
}

function findClosestString(
  midi: number,
  strings: InstrumentString[],
): ClosestStringMatch | null {
  if (strings.length === 0) {
    return null
  }
  let bestIndex = 0
  let bestDelta = Math.abs(strings[0].midi - midi)
  for (let i = 1; i < strings.length; i++) {
    const delta = Math.abs(strings[i].midi - midi)
    if (delta < bestDelta) {
      bestDelta = delta
      bestIndex = i
    }
  }
  const stringDef = strings[bestIndex]
  return {
    index: bestIndex,
    string: stringDef,
    semitoneDelta: midi - stringDef.midi,
  }
}

export function TunerScreen() {
  const { state, start, stop } = useTuner()
  const { settings, updateSettings } = useTunerSettings()
  const stickySample = useStickySample(state.sample)

  const [sheet, setSheet] = useState<SheetKind>(null)
  const [history, setHistory] = useState<HistorySample[]>([])
  const [holdMs, setHoldMs] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const holdStartRef = useRef<number | null>(null)
  const historyLastAtRef = useRef(0)
  const historyLastMidiRef = useRef<number | null>(null)

  const inTuneCents = settings.inTuneCents
  const nearCents = inTuneCents * 3

  const note = stickySample
    ? frequencyToNote(stickySample.frequency, settings.referenceA4)
    : null
  const active = state.status === 'running' && note !== null

  useEffect(() => {
    if (state.status !== 'running' || !state.sample || state.sample.frequency <= 0) {
      return
    }
    const detected = frequencyToNote(state.sample.frequency, settings.referenceA4)
    if (!detected) {
      return
    }
    const now = Date.now()
    const sameNote = historyLastMidiRef.current === detected.midi
    const timeSinceLast = now - historyLastAtRef.current
    if (sameNote && timeSinceLast < HISTORY_THROTTLE_MS) {
      return
    }
    historyLastAtRef.current = now
    historyLastMidiRef.current = detected.midi
    setHistory((prev) => [...prev.slice(-(HISTORY_MAX - 1)), { cents: detected.cents }])
  }, [state.sample, state.status, settings.referenceA4])

  useEffect(() => {
    if (state.status === 'idle') {
      setHistory([])
      historyLastMidiRef.current = null
      historyLastAtRef.current = 0
      setConfirmed(false)
      setHoldMs(0)
      holdStartRef.current = null
    }
  }, [state.status])

  const isInTune = active && note !== null && Math.abs(note.cents) <= inTuneCents

  useEffect(() => {
    if (!isInTune) {
      holdStartRef.current = null
      setHoldMs(0)
      setConfirmed(false)
      return
    }
    if (holdStartRef.current === null) {
      holdStartRef.current = Date.now()
    }
    const id = window.setInterval(() => {
      if (holdStartRef.current === null) {
        return
      }
      const elapsed = Date.now() - holdStartRef.current
      setHoldMs(elapsed)
      if (elapsed >= CONFIRM_HOLD_MS) {
        setConfirmed(true)
      }
    }, 80)
    return () => {
      window.clearInterval(id)
    }
  }, [isInTune])

  if (state.status === 'error' && state.error) {
    return <ErrorView error={state.error} onRetry={() => void start()} onIdle={stop} />
  }

  if (state.status === 'idle') {
    return <IdleView starting={false} onStart={() => void start()} />
  }

  if (state.status === 'starting' && !stickySample) {
    return <IdleView starting onStart={() => void start()} />
  }

  const noteName = note
    ? formatNoteName(note.noteIndex, settings.notation, settings.accidental)
    : null
  const split = noteName ? splitNoteName(noteName) : null
  const accidental = split?.accidental ?? null
  const baseLabel = split?.base ?? null

  const detectedFreq = stickySample?.frequency ?? 0
  const targetFreq = note ? midiToFrequency(note.midi, settings.referenceA4) : 0
  const clarityPercent = Math.round((stickySample?.clarity ?? 0) * 100)

  const instrument: Instrument = getInstrument(settings.instrument)
  const closestString =
    note && instrument.strings ? findClosestString(note.midi, instrument.strings) : null

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-3.5 px-6 pb-6 pt-3">
      <div className="pg-topbar">
        <div className="pg-brand">
          <span className="pg-brand-dot" />
          <span>pulse·groove</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="pg-section-label">{instrument.name}</span>
          <Link
            to="/settings"
            aria-label="Open settings"
            className="text-[color:var(--color-muted)] transition hover:text-[color:var(--color-fg)]"
          >
            <SettingsIcon size={14} strokeWidth={1.6} />
          </Link>
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3 font-mono"
        style={{
          fontSize: 10.5,
          color: 'var(--color-muted)',
          letterSpacing: '0.06em',
        }}
      >
        <button
          type="button"
          onClick={() => setSheet('reference')}
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <span>
            A4 ·{' '}
            <strong style={{ color: 'var(--color-fg)', fontWeight: 500 }}>
              {settings.referenceA4} Hz
            </strong>
          </span>
          <ChevronRight size={11} strokeWidth={1.8} />
        </button>
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span>clarity {clarityPercent}%</span>
          {confirmed && (
            <span className="pg-badge">
              <Check size={11} strokeWidth={2.2} /> In tune
            </span>
          )}
        </div>
      </div>

      <div
        className="relative flex items-center justify-center"
        style={{ height: 280 }}
      >
        <CentsRing
          cents={note?.cents ?? 0}
          active={active}
          noteLabel={baseLabel}
          accidental={accidental}
          octave={note?.octave ?? null}
          size={290}
          holdProgress={Math.min(1, holdMs / CONFIRM_HOLD_MS)}
        />
      </div>

      <div className="flex items-baseline justify-between gap-3 px-1">
        <div className="min-w-0">
          <div
            className="pg-numeric whitespace-nowrap"
            style={{
              fontSize: 28,
              fontWeight: 300,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: active && note
                ? centsColorVar(note.cents, inTuneCents, nearCents)
                : 'var(--color-muted)',
            }}
          >
            {active && note ? `${note.cents >= 0 ? '+' : ''}${note.cents.toFixed(1)}` : '0.0'}
            <span style={{ fontSize: 15, marginLeft: 1 }}>¢</span>
          </div>
          <div
            className="mt-1.5 whitespace-nowrap font-mono"
            style={{
              fontSize: 10.5,
              color: 'var(--color-muted)',
              letterSpacing: '0.06em',
            }}
          >
            {getNarrative(note?.cents ?? null, active)}
          </div>
        </div>
        <div className="min-w-0 text-right">
          <div
            className="pg-numeric whitespace-nowrap"
            style={{ fontSize: 18, fontWeight: 400, color: 'var(--color-fg)' }}
          >
            {active ? detectedFreq.toFixed(2) : '—'}{' '}
            <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>Hz</span>
          </div>
          <div
            className="mt-1.5 whitespace-nowrap font-mono"
            style={{
              fontSize: 10.5,
              color: 'var(--color-muted)',
              letterSpacing: '0.06em',
            }}
          >
            target {active && note ? targetFreq.toFixed(2) : '—'} Hz
          </div>
        </div>
      </div>

      <HistoryStrip history={history} />

      <InstrumentTargetCard
        instrument={instrument}
        note={note}
        active={active}
        baseLabel={baseLabel}
        accidental={accidental}
        closestString={closestString}
        isInTune={isInTune}
        onOpen={() => setSheet('instrument')}
      />

      <div className="mt-auto flex items-center gap-2 pt-1">
        <div
          className="flex h-12 flex-1 gap-1 p-1"
          style={{
            background: 'var(--color-paper)',
            border: '0.5px solid var(--color-border-strong)',
            borderRadius: 14,
          }}
        >
          <NotationButton
            label="C – D – E"
            selected={settings.notation === 'english'}
            onClick={() => updateSettings({ notation: 'english' })}
          />
          <NotationButton
            label="Do – Re – Mi"
            selected={settings.notation === 'latin'}
            onClick={() => updateSettings({ notation: 'latin' })}
          />
        </div>
        <button
          type="button"
          onClick={stop}
          aria-label="Stop tuner"
          className="flex h-12 w-12 items-center justify-center rounded-[14px]"
          style={{
            background: 'transparent',
            border: '0.5px solid var(--color-border-strong)',
            color: 'var(--color-fg-dim)',
          }}
        >
          <MicOff size={16} strokeWidth={1.6} />
        </button>
      </div>

      <BottomSheet
        open={sheet === 'reference'}
        onClose={() => setSheet(null)}
        title="Reference pitch"
      >
        <div className="flex flex-col gap-3">
          <p
            className="font-mono"
            style={{
              fontSize: 11,
              color: 'var(--color-muted)',
              lineHeight: 1.5,
            }}
          >
            The frequency assigned to A above middle C. Most modern music uses 440 Hz; some European
            orchestras prefer 442, early-music ensembles 415.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REFERENCE_A4_PRESETS.map((hz) => (
              <Chip
                key={hz}
                active={settings.referenceA4 === hz}
                onClick={() => {
                  updateSettings({ referenceA4: hz })
                  setSheet(null)
                }}
                style={{ minWidth: 72, justifyContent: 'center' }}
              >
                {hz} Hz
              </Chip>
            ))}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === 'instrument'}
        onClose={() => setSheet(null)}
        title="Instrument target"
      >
        <div className="flex max-h-[360px] flex-col overflow-y-auto">
          {INSTRUMENTS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                updateSettings({ instrument: option.id })
                setSheet(null)
              }}
              className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
              style={{ borderBottom: '0.5px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-fg)' }}>
                  {option.name}
                </span>
                {settings.instrument === option.id && (
                  <Check size={13} strokeWidth={2} style={{ color: 'var(--color-accent)' }} />
                )}
              </div>
              <span
                className="font-mono"
                style={{ fontSize: 10.5, color: 'var(--color-muted)', letterSpacing: '0.04em' }}
              >
                {option.strings ? option.strings.map((s) => s.name).join(' ') : 'any pitch'}
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}

function NotationButton({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center rounded-[10px] transition"
      style={{
        background: selected ? 'var(--color-fg)' : 'transparent',
        color: selected ? 'var(--color-bg)' : 'var(--color-muted)',
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.04em',
        height: '100%',
      }}
    >
      {label}
    </button>
  )
}

function InstrumentTargetCard({
  instrument,
  note,
  active,
  baseLabel,
  accidental,
  closestString,
  isInTune,
  onOpen,
}: {
  instrument: Instrument
  note: DetectedNote | null
  active: boolean
  baseLabel: string | null
  accidental: '♯' | '♭' | null
  closestString: ClosestStringMatch | null
  isInTune: boolean
  onOpen: () => void
}) {
  return (
    <div className="pg-card">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <span className="pg-section-label">{instrument.name} target</span>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 whitespace-nowrap font-mono"
          style={{
            color: 'var(--color-accent)',
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: '0.06em',
          }}
        >
          change <ChevronRight size={10} strokeWidth={1.8} />
        </button>
      </div>
      {instrument.strings ? (
        <div className="flex gap-1">
          {instrument.strings.map((stringDef, index) => {
            const isClosest = closestString?.index === index
            const semis = closestString?.semitoneDelta ?? 0
            const tunedHere = isClosest && isInTune
            const stringOctave = octaveFromMidi(stringDef.midi)
            const dotBackground = tunedHere
              ? 'var(--color-good)'
              : isClosest
                ? 'var(--color-accent)'
                : 'var(--color-border-strong)'
            const deltaLabel =
              isClosest && note
                ? semis === 0
                  ? `${note.cents >= 0 ? '+' : ''}${note.cents.toFixed(0)}¢`
                  : `${semis > 0 ? '+' : ''}${semis}st`
                : ''
            return (
              <button
                key={`${stringDef.name}-${index}`}
                type="button"
                className={`pg-string ${isClosest ? 'is-target' : ''} ${tunedHere ? 'is-tuned' : ''}`}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: isClosest ? 'var(--color-fg)' : 'var(--color-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {stringDef.name}
                  <sub style={{ fontSize: 8, opacity: 0.6 }}>{stringOctave}</sub>
                </span>
                <span className="pg-string-dot" style={{ background: dotBackground }} />
                <span
                  className="whitespace-nowrap"
                  style={{ fontSize: 9, color: 'var(--color-muted)' }}
                >
                  {deltaLabel || ' '}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 py-1">
          <span
            className="whitespace-nowrap font-mono"
            style={{ fontSize: 11, color: 'var(--color-muted)' }}
          >
            Any pitch · 12 notes
          </span>
          <span
            className="whitespace-nowrap font-mono"
            style={{ fontSize: 12, color: 'var(--color-fg)', letterSpacing: '0.06em' }}
          >
            {active && baseLabel ? (
              <>
                {baseLabel}
                {accidental ?? ''}
                <sub style={{ fontSize: 8 }}>{note?.octave}</sub>
              </>
            ) : (
              '—'
            )}
          </span>
        </div>
      )}
    </div>
  )
}

function IdleView({ starting, onStart }: { starting: boolean; onStart: () => void }) {
  return (
    <div className="relative mx-auto flex h-full w-full max-w-md flex-col px-6 pt-3">
      <div className="pg-topbar">
        <div className="pg-brand">
          <span className="pg-brand-dot" />
          <span>pulse·groove</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="pg-section-label">Tuner</span>
          <Link
            to="/settings"
            aria-label="Open settings"
            className="text-[color:var(--color-muted)] transition hover:text-[color:var(--color-fg)]"
          >
            <SettingsIcon size={14} strokeWidth={1.6} />
          </Link>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-7 px-6 text-center">
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="relative flex h-32 w-32 items-center justify-center rounded-full text-white"
          style={{
            background: 'var(--color-accent)',
            boxShadow: '0 16px 48px var(--color-accent-soft)',
          }}
        >
          <span
            className="absolute rounded-full"
            style={{
              inset: -10,
              border: '1px solid var(--color-accent)',
              opacity: 0.45,
              animation: 'pg-ring-expand 1900ms ease-out infinite',
            }}
          />
          <Mic size={46} strokeWidth={1.4} />
        </button>
        <div>
          <div
            className="pg-display"
            style={{
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: '-0.015em',
            }}
          >
            {starting ? 'Listening…' : 'Tap to listen'}
          </div>
          <div
            className="mt-2.5 font-mono"
            style={{
              fontSize: 11,
              color: 'var(--color-muted)',
              letterSpacing: '0.06em',
            }}
          >
            Chromatic · A4 = 440 Hz · in-tune within ±5¢
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorView({
  error,
  onRetry,
  onIdle,
}: {
  error: TunerError
  onRetry: () => void
  onIdle: () => void
}) {
  const errorMeta: Record<string, { title: string; body: string }> = {
    denied: {
      title: 'Microphone blocked',
      body: 'Allow microphone access from the address bar, then try again.',
    },
    'not-found': {
      title: 'No microphone',
      body: 'Plug in or pair a microphone, then try again.',
    },
    busy: {
      title: 'Microphone in use',
      body: 'Close any other app using the microphone and try again.',
    },
    insecure: {
      title: 'Insecure connection',
      body: 'The tuner needs HTTPS to access the microphone.',
    },
    other: {
      title: 'Microphone error',
      body: error.message,
    },
  }
  const meta = errorMeta[error.kind] ?? errorMeta.other

  return (
    <div className="relative mx-auto flex h-full w-full max-w-md flex-col px-6 pt-3">
      <div className="pg-topbar">
        <div className="pg-brand">
          <span className="pg-brand-dot" />
          <span>pulse·groove</span>
        </div>
        <span className="pg-section-label">Tuner</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-7 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{
            background: 'var(--color-paper)',
            border: '0.5px solid var(--color-border-strong)',
            color: 'var(--color-bad)',
          }}
        >
          <MicOff size={34} strokeWidth={1.4} />
        </div>
        <div>
          <div className="pg-display" style={{ fontSize: 22, fontWeight: 500 }}>
            {meta.title}
          </div>
          <p
            className="mt-2.5 max-w-[280px]"
            style={{
              fontSize: 13,
              color: 'var(--color-muted)',
              lineHeight: 1.5,
            }}
          >
            {meta.body}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-sans uppercase"
          style={{
            background: 'var(--color-fg)',
            color: 'var(--color-bg)',
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.05em',
          }}
        >
          <RefreshCw size={13} strokeWidth={1.8} />
          Try again
        </button>
        <p
          className="text-[10px] uppercase"
          style={{ color: 'var(--color-muted)', letterSpacing: '0.18em' }}
        >
          {error.name}
        </p>
      </div>
      <div className="pb-2 pt-1 text-center">
        <Chip onClick={onIdle}>Back</Chip>
      </div>
    </div>
  )
}
