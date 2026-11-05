// Pure copy/label helpers for the tuner screen (no React, no RN: vitest-able).
import { formatNoteName, octaveFromMidi, splitNoteName, type Accidental, type Notation } from '../core/notes'
import type { TunerErrorKind } from '../audio/tuner'

export type NoteParts = { base: string; accidental: '♯' | '♭' | null; octave: number }

/** Note letter, accidental glyph and octave for a midi number in the user's notation. */
export function noteParts(midi: number, notation: Notation, accidental: Accidental): NoteParts {
  const name = formatNoteName(((midi % 12) + 12) % 12, notation, accidental)
  const split = splitNoteName(name)
  return { base: split.base, accidental: split.accidental, octave: octaveFromMidi(midi) }
}

/**
 * Delta shown under the closest string (web parity): cents when on the string,
 * semitones otherwise; empty when there is no note.
 */
export function stringDeltaLabel(semitoneDelta: number | null, cents: number | null): string {
  if (semitoneDelta === null || cents === null) return ''
  if (semitoneDelta === 0) return `${cents >= 0 ? '+' : ''}${cents.toFixed(0)}¢`
  return `${semitoneDelta > 0 ? '+' : ''}${semitoneDelta}st`
}

/** Idle hint built from the live settings (the web hard-codes the defaults). */
export function idleHint(instrumentName: string, referenceA4: number, inTuneCents: number): string {
  return `${instrumentName} · A4 = ${referenceA4} Hz · in-tune within ±${inTuneCents}¢`
}

export function clarityPercent(clarity: number | null | undefined): number {
  if (clarity === null || clarity === undefined || !Number.isFinite(clarity)) return 0
  return Math.round(Math.min(1, Math.max(0, clarity)) * 100)
}

export type ErrorCopy = { title: string; body: string; canOpenSettings: boolean }

export function errorCopy(kind: TunerErrorKind | string, message: string): ErrorCopy {
  if (kind === 'denied') {
    return {
      title: 'Microphone blocked',
      body: 'Allow microphone access for TunePulse in system Settings, then try again.',
      canOpenSettings: true,
    }
  }
  return { title: 'Microphone error', body: message || 'Something went wrong.', canOpenSettings: false }
}
