import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, RefreshCw } from 'lucide-react'
import { useTuner, type TunerError } from '../hooks/useTuner'
import { formatNoteName, frequencyToNote } from '../lib/notes'
import type { PitchSample } from '../audio/pitchDetector'

const IN_TUNE_CENTS = 5
const NEAR_CENTS = 15
const HOLD_MS = 1500

function centsColor(cents: number): string {
  const abs = Math.abs(cents)
  if (abs <= IN_TUNE_CENTS) {
    return 'var(--color-accent)'
  }
  if (abs <= NEAR_CENTS) {
    return 'var(--color-warn)'
  }
  return 'var(--color-bad)'
}

/** Keep the last valid sample on screen for HOLD_MS so the display doesn't
 *  flicker between detection frames where clarity briefly dips. */
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
      }, HOLD_MS)
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

export function TunerScreen() {
  const { state, start, stop } = useTuner()
  const stickySample = useStickySample(state.sample)

  if (state.status === 'error' && state.error) {
    return <ErrorView error={state.error} onRetry={() => void start()} />
  }

  if (state.status === 'idle') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-sm uppercase tracking-widest text-[color:var(--color-muted)]">
          Chromatic Tuner
        </p>
        <button
          type="button"
          onClick={() => void start()}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-bg)] transition active:scale-95"
          aria-label="Enable microphone"
        >
          <Mic className="h-10 w-10" />
        </button>
        <p className="text-sm text-[color:var(--color-muted)]">Tap to start</p>
      </div>
    )
  }

  const note = stickySample ? frequencyToNote(stickySample.frequency) : null
  const isWaiting = state.status === 'starting' || !note

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-[color:var(--color-muted)]">
          {isWaiting ? 'Listening…' : 'Detected'}
        </p>
        <div className="mt-4 flex items-baseline justify-center gap-2 font-mono tabular-nums">
          <span className="text-8xl font-light">
            {note ? formatNoteName(note.noteIndex) : '—'}
          </span>
          {note && (
            <span className="text-2xl text-[color:var(--color-muted)]">{note.octave}</span>
          )}
        </div>
        {note && (
          <p
            className="mt-2 font-mono text-2xl tabular-nums"
            style={{ color: centsColor(note.cents) }}
          >
            {note.cents >= 0 ? '+' : ''}
            {note.cents.toFixed(1)}¢
          </p>
        )}
        {stickySample && stickySample.frequency > 0 && (
          <p className="mt-1 text-xs text-[color:var(--color-muted)]">
            {stickySample.frequency.toFixed(2)} Hz
          </p>
        )}
      </div>

      <CentsMeter cents={note?.cents ?? 0} active={!!note} />

      <button
        type="button"
        onClick={stop}
        className="absolute right-4 top-4 rounded-full p-2 text-[color:var(--color-muted)]"
        aria-label="Stop tuner"
      >
        <MicOff className="h-5 w-5" />
      </button>
    </div>
  )
}

function ErrorView({ error, onRetry }: { error: TunerError; onRetry: () => void }) {
  return (
    <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-5 px-6 text-center">
      <MicOff className="h-12 w-12 text-[color:var(--color-bad)]" />
      <div>
        <p className="text-base font-medium">{error.message}</p>
        {error.kind === 'denied' && <DeniedInstructions />}
        {error.kind === 'busy' && (
          <p className="mt-3 text-sm text-[color:var(--color-muted)]">
            Close any other tab or app that may be using the microphone and try again.
          </p>
        )}
        {error.kind === 'not-found' && (
          <p className="mt-3 text-sm text-[color:var(--color-muted)]">
            Plug in or pair a microphone, then try again.
          </p>
        )}
        {error.kind === 'insecure' && (
          <p className="mt-3 text-sm text-[color:var(--color-muted)]">
            Open this site over HTTPS.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 rounded-full bg-[color:var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-bg)] transition active:scale-95"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
      <p className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)]">
        {error.name}
      </p>
    </div>
  )
}

function DeniedInstructions() {
  return (
    <div className="mt-4 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-left text-xs text-[color:var(--color-muted)]">
      <p className="mb-2 font-medium text-[color:var(--color-fg)]">To enable the microphone:</p>
      <ol className="list-decimal space-y-1 pl-4">
        <li>Tap the lock or info icon next to the address bar.</li>
        <li>Find <span className="font-medium">Microphone</span> and set it to <span className="font-medium">Allow</span>.</li>
        <li>Reload the page and tap <span className="font-medium">Try again</span>.</li>
      </ol>
    </div>
  )
}

const METER_RANGE_CENTS = 50

function centsToPercent(cents: number): number {
  const clamped = Math.max(-METER_RANGE_CENTS, Math.min(METER_RANGE_CENTS, cents))
  return ((clamped + METER_RANGE_CENTS) / (2 * METER_RANGE_CENTS)) * 100
}

function CentsMeter({ cents, active }: { cents: number; active: boolean }) {
  const indicatorPercent = centsToPercent(cents)
  const warnLeft = centsToPercent(-NEAR_CENTS)
  const warnRight = 100 - centsToPercent(NEAR_CENTS)
  const tuneLeft = centsToPercent(-IN_TUNE_CENTS)
  const tuneRight = 100 - centsToPercent(IN_TUNE_CENTS)

  return (
    <div className="w-full max-w-sm">
      <div className="relative h-3 overflow-hidden rounded-full bg-[color:var(--color-border)]">
        <div
          className="absolute inset-y-0 opacity-40"
          style={{
            left: `${warnLeft}%`,
            right: `${warnRight}%`,
            backgroundColor: 'var(--color-warn)',
          }}
        />
        <div
          className="absolute inset-y-0 opacity-60"
          style={{
            left: `${tuneLeft}%`,
            right: `${tuneRight}%`,
            backgroundColor: 'var(--color-accent)',
          }}
        />
        <div
          className="absolute top-0 h-full w-px bg-[color:var(--color-fg)] opacity-60"
          style={{ left: '50%' }}
        />
        {active && (
          <div
            className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--color-fg)] shadow-md transition-[left] duration-75"
            style={{ left: `${indicatorPercent}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[color:var(--color-muted)]">
        <span>-50¢</span>
        <span>0</span>
        <span>+50¢</span>
      </div>
    </div>
  )
}
