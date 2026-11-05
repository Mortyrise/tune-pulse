// Pure config limits + validation (port of the web useMetronome `loadConfig`).
import {
  DEFAULT_METRONOME,
  type CountInBars,
  type Denominator,
  type MetronomeConfig,
  type Subdivision,
} from './metronomeLayout'

export const MIN_BPM = 30
export const MAX_BPM = 300
export const MIN_NUMERATOR = 1
export const MAX_NUMERATOR = 12
export const DENOMINATOR_OPTIONS: Denominator[] = [2, 4, 8, 16]
export const SUBDIVISION_OPTIONS: Subdivision[] = [1, 2, 3, 4]
export const COUNT_IN_OPTIONS: CountInBars[] = [0, 1, 2]

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULT_METRONOME.bpm
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)))
}

export function clampNumerator(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_METRONOME.numerator
  return Math.max(MIN_NUMERATOR, Math.min(MAX_NUMERATOR, Math.round(n)))
}

export function fitArrayLength<T>(array: T[], length: number, fill: T): T[] {
  if (array.length === length) return array
  if (array.length < length) return [...array, ...Array<T>(length - array.length).fill(fill)]
  return array.slice(0, length)
}

/** Next subdivision in the BeatColumn cycle 1 → 2 → 3 → 4 → 1. */
export function nextSubdivision(current: Subdivision): Subdivision {
  const i = SUBDIVISION_OPTIONS.indexOf(current)
  return SUBDIVISION_OPTIONS[(i + 1) % SUBDIVISION_OPTIONS.length]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Coerce anything (stored JSON, saved patterns) into a valid config. Never throws. */
export function sanitizeConfig(raw: unknown): MetronomeConfig {
  if (!isRecord(raw)) return DEFAULT_METRONOME
  const numerator =
    typeof raw.numerator === 'number' && Number.isInteger(raw.numerator)
      ? clampNumerator(raw.numerator)
      : DEFAULT_METRONOME.numerator
  const beats = isRecord(raw.beats) ? raw.beats : {}
  const accents = Array.isArray(beats.accents)
    ? [
        ...new Set(
          beats.accents.filter(
            (b): b is number => typeof b === 'number' && Number.isInteger(b) && b >= 1 && b <= numerator,
          ),
        ),
      ].sort((a, b) => a - b)
    : DEFAULT_METRONOME.beats.accents.filter((b) => b <= numerator)
  const subdivisions = Array.isArray(beats.subdivisions)
    ? beats.subdivisions.map((s): Subdivision => (SUBDIVISION_OPTIONS.includes(s as Subdivision) ? (s as Subdivision) : 1))
    : []
  return {
    bpm: typeof raw.bpm === 'number' ? clampBpm(raw.bpm) : DEFAULT_METRONOME.bpm,
    numerator,
    denominator: DENOMINATOR_OPTIONS.includes(raw.denominator as Denominator)
      ? (raw.denominator as Denominator)
      : DEFAULT_METRONOME.denominator,
    beats: { accents, subdivisions: fitArrayLength<Subdivision>(subdivisions, numerator, 1) },
    countInBars: COUNT_IN_OPTIONS.includes(raw.countInBars as CountInBars)
      ? (raw.countInBars as CountInBars)
      : DEFAULT_METRONOME.countInBars,
    hapticMode: typeof raw.hapticMode === 'boolean' ? raw.hapticMode : DEFAULT_METRONOME.hapticMode,
  }
}
