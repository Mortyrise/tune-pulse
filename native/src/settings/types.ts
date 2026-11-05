import type { Accidental, Notation } from '../core/notes'

export type InTuneTolerance = 3 | 5 | 10
export type InstrumentId = 'chromatic' | 'guitar' | 'bass' | 'ukulele' | 'violin'

/** Same shape as the web `TunerSettings` (+ instrument). */
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

export const DEFAULT_TUNER_SETTINGS: TunerSettings = {
  notation: 'english',
  accidental: 'sharp',
  referenceA4: 440,
  inTuneCents: 5,
  instrument: 'chromatic',
}

/** Same key as the web app. */
export const TUNER_SETTINGS_KEY = 'tunepulse:tuner-settings'
