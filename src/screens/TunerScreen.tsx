import { useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useTuner } from '../hooks/useTuner'
import { formatNoteName, frequencyToNote } from '../lib/notes'

const IN_TUNE_CENTS = 5
const NEAR_CENTS = 15

function centsColor(cents: number): string {
  const abs = Math.abs(cents)
  if (abs <= IN_TUNE_CENTS) return 'var(--color-accent)'
  if (abs <= NEAR_CENTS) return 'var(--color-warn)'
  return 'var(--color-bad)'
}

export function TunerScreen() {
  const [enabled, setEnabled] = useState(false)
  const state = useTuner(enabled)

  if (state.status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <MicOff className="h-12 w-12 text-[color:var(--color-bad)]" />
        <p className="text-sm text-[color:var(--color-muted)]">
          {state.error ?? 'Microphone unavailable'}
        </p>
        <button
          type="button"
          onClick={() => setEnabled(false)}
          className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm"
        >
          Reset
        </button>
      </div>
    )
  }

  if (!enabled || state.status === 'idle') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-sm uppercase tracking-widest text-[color:var(--color-muted)]">
          Chromatic Tuner
        </p>
        <button
          type="button"
          onClick={() => setEnabled(true)}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-bg)] transition active:scale-95"
          aria-label="Enable microphone"
        >
          <Mic className="h-10 w-10" />
        </button>
        <p className="text-sm text-[color:var(--color-muted)]">Tap to start</p>
      </div>
    )
  }

  const note = state.sample ? frequencyToNote(state.sample.frequency) : null
  const isListening = state.status === 'starting' || !note

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-[color:var(--color-muted)]">
          {isListening ? 'Listening…' : 'Detected'}
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
        {state.sample && state.sample.frequency > 0 && (
          <p className="mt-1 text-xs text-[color:var(--color-muted)]">
            {state.sample.frequency.toFixed(2)} Hz
          </p>
        )}
      </div>

      <CentsMeter cents={note?.cents ?? 0} active={!!note} />

      <button
        type="button"
        onClick={() => setEnabled(false)}
        className="absolute right-4 top-4 rounded-full p-2 text-[color:var(--color-muted)]"
        aria-label="Stop tuner"
      >
        <MicOff className="h-5 w-5" />
      </button>
    </div>
  )
}

function CentsMeter({ cents, active }: { cents: number; active: boolean }) {
  const clamped = Math.max(-50, Math.min(50, cents))
  const percent = ((clamped + 50) / 100) * 100
  return (
    <div className="w-full max-w-sm">
      <div className="relative h-1.5 rounded-full bg-[color:var(--color-border)]">
        <div
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-[color:var(--color-muted)]"
          style={{ left: '50%' }}
        />
        {active && (
          <div
            className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-75"
            style={{
              left: `${percent}%`,
              backgroundColor: centsColor(cents),
            }}
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
