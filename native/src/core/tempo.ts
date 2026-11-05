export type TempoCharacter = {
  max: number
  name: string
  meaning: string
}

export const TEMPO_CHARACTERS: TempoCharacter[] = [
  { max: 40, name: 'Grave', meaning: 'Solemn · very slow' },
  { max: 60, name: 'Largo', meaning: 'Broad · slow' },
  { max: 66, name: 'Larghetto', meaning: 'Rather broad' },
  { max: 76, name: 'Adagio', meaning: 'At ease' },
  { max: 108, name: 'Andante', meaning: 'Walking pace' },
  { max: 120, name: 'Moderato', meaning: 'Moderate' },
  { max: 156, name: 'Allegro', meaning: 'Lively · quick' },
  { max: 176, name: 'Vivace', meaning: 'Brisk · lively' },
  { max: 200, name: 'Presto', meaning: 'Very fast' },
  { max: Infinity, name: 'Prestissimo', meaning: 'Extremely fast' },
]

export function getTempoCharacter(bpm: number): TempoCharacter {
  const match = TEMPO_CHARACTERS.find((t) => bpm <= t.max)
  return match ?? TEMPO_CHARACTERS[TEMPO_CHARACTERS.length - 1]
}

export const TAP_WINDOW = 4
export const TAP_RESET_MS = 2000

/**
 * Tap-tempo step (web useTapTempo logic, pure). Pushes `now` into `taps` (mutated: reset
 * after a 2 s gap, window of 4) and returns the BPM from the mean interval, or null.
 */
export function registerTap(taps: number[], now: number): number | null {
  const last = taps[taps.length - 1]
  if (last !== undefined && now - last > TAP_RESET_MS) {
    taps.length = 0
    taps.push(now)
    return null
  }
  taps.push(now)
  if (taps.length > TAP_WINDOW) taps.shift()
  if (taps.length < 2) return null
  const mean = (taps[taps.length - 1] - taps[0]) / (taps.length - 1)
  return mean > 0 ? Math.round(60_000 / mean) : null
}
