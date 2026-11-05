// Pure validators for persisted tuner settings (port of the web loadSettings).
import type { Accidental, Notation } from '../core/notes'
import {
  DEFAULT_TUNER_SETTINGS,
  MAX_REFERENCE_A4,
  MIN_REFERENCE_A4,
  type InTuneTolerance,
  type InstrumentId,
  type TunerSettings,
} from './types'

const VALID_INSTRUMENTS: InstrumentId[] = ['chromatic', 'guitar', 'bass', 'ukulele', 'violin']

const isNotation = (v: unknown): v is Notation => v === 'english' || v === 'latin'
const isAccidental = (v: unknown): v is Accidental => v === 'sharp' || v === 'flat'
const isTolerance = (v: unknown): v is InTuneTolerance => v === 3 || v === 5 || v === 10
const isInstrument = (v: unknown): v is InstrumentId =>
  typeof v === 'string' && (VALID_INSTRUMENTS as string[]).includes(v)

export function clampReferenceA4(value: number): number {
  return Math.max(MIN_REFERENCE_A4, Math.min(MAX_REFERENCE_A4, Math.round(value)))
}

/** Any value → valid TunerSettings; invalid fields fall back to the defaults. */
export function sanitizeTunerSettings(value: unknown): TunerSettings {
  const p = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof TunerSettings, unknown>>
  const d = DEFAULT_TUNER_SETTINGS
  return {
    notation: isNotation(p.notation) ? p.notation : d.notation,
    accidental: isAccidental(p.accidental) ? p.accidental : d.accidental,
    referenceA4:
      typeof p.referenceA4 === 'number' && Number.isFinite(p.referenceA4)
        ? clampReferenceA4(p.referenceA4)
        : d.referenceA4,
    inTuneCents: isTolerance(p.inTuneCents) ? p.inTuneCents : d.inTuneCents,
    instrument: isInstrument(p.instrument) ? p.instrument : d.instrument,
  }
}
