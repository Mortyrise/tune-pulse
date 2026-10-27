import { createContext, useContext } from 'react'
import type { Accidental, Notation } from '../lib/notes'
import type { InstrumentId } from '../lib/instruments'

export type InTuneTolerance = 3 | 5 | 10

export type TunerSettings = {
  notation: Notation
  accidental: Accidental
  referenceA4: number
  inTuneCents: InTuneTolerance
  instrument: InstrumentId
}

export const TOLERANCE_OPTIONS: InTuneTolerance[] = [3, 5, 10]
export const REFERENCE_A4_PRESETS: number[] = [415, 432, 438, 440, 442, 444]
export const MIN_REFERENCE_A4 = 400
export const MAX_REFERENCE_A4 = 480
const VALID_INSTRUMENTS: InstrumentId[] = ['chromatic', 'guitar', 'bass', 'ukulele', 'violin']

export const DEFAULT_TUNER_SETTINGS: TunerSettings = {
  notation: 'english',
  accidental: 'sharp',
  referenceA4: 440,
  inTuneCents: 5,
  instrument: 'chromatic',
}

export const STORAGE_KEY = 'tunepulse:tuner-settings'

function isValidNotation(value: unknown): value is Notation {
  return value === 'english' || value === 'latin'
}

function isValidAccidental(value: unknown): value is Accidental {
  return value === 'sharp' || value === 'flat'
}

function isValidTolerance(value: unknown): value is InTuneTolerance {
  return value === 3 || value === 5 || value === 10
}

function isValidInstrument(value: unknown): value is InstrumentId {
  return typeof value === 'string' && (VALID_INSTRUMENTS as string[]).includes(value)
}

export function clampReferenceA4(value: number): number {
  return Math.max(MIN_REFERENCE_A4, Math.min(MAX_REFERENCE_A4, Math.round(value)))
}

export function loadSettings(): TunerSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_TUNER_SETTINGS
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return DEFAULT_TUNER_SETTINGS
    }
    const parsed = JSON.parse(raw) as Partial<TunerSettings>
    return {
      notation: isValidNotation(parsed.notation) ? parsed.notation : DEFAULT_TUNER_SETTINGS.notation,
      accidental: isValidAccidental(parsed.accidental)
        ? parsed.accidental
        : DEFAULT_TUNER_SETTINGS.accidental,
      referenceA4:
        typeof parsed.referenceA4 === 'number' && Number.isFinite(parsed.referenceA4)
          ? clampReferenceA4(parsed.referenceA4)
          : DEFAULT_TUNER_SETTINGS.referenceA4,
      inTuneCents: isValidTolerance(parsed.inTuneCents)
        ? parsed.inTuneCents
        : DEFAULT_TUNER_SETTINGS.inTuneCents,
      instrument: isValidInstrument(parsed.instrument)
        ? parsed.instrument
        : DEFAULT_TUNER_SETTINGS.instrument,
    }
  } catch {
    return DEFAULT_TUNER_SETTINGS
  }
}

export type TunerSettingsContextValue = {
  settings: TunerSettings
  updateSettings: (partial: Partial<TunerSettings>) => void
  resetSettings: () => void
}

export const TunerSettingsContext = createContext<TunerSettingsContextValue | null>(null)

export function useTunerSettings(): TunerSettingsContextValue {
  const ctx = useContext(TunerSettingsContext)
  if (!ctx) {
    throw new Error('useTunerSettings must be used inside TunerSettingsProvider')
  }
  return ctx
}
