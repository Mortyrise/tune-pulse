// Ported from the web app (src/lib/instruments.ts) + findClosestString from its TunerScreen.
export type InstrumentId = 'chromatic' | 'guitar' | 'bass' | 'ukulele' | 'violin'

export type InstrumentString = {
  name: string
  midi: number
}

export type Instrument = {
  id: InstrumentId
  name: string
  strings: InstrumentString[] | null
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'chromatic', name: 'Chromatic', strings: null },
  {
    id: 'guitar',
    name: 'Guitar',
    strings: [
      { name: 'E', midi: 40 },
      { name: 'A', midi: 45 },
      { name: 'D', midi: 50 },
      { name: 'G', midi: 55 },
      { name: 'B', midi: 59 },
      { name: 'E', midi: 64 },
    ],
  },
  {
    id: 'bass',
    name: 'Bass',
    strings: [
      { name: 'E', midi: 28 },
      { name: 'A', midi: 33 },
      { name: 'D', midi: 38 },
      { name: 'G', midi: 43 },
    ],
  },
  {
    id: 'ukulele',
    name: 'Ukulele',
    strings: [
      { name: 'G', midi: 67 },
      { name: 'C', midi: 60 },
      { name: 'E', midi: 64 },
      { name: 'A', midi: 69 },
    ],
  },
  {
    id: 'violin',
    name: 'Violin',
    strings: [
      { name: 'G', midi: 55 },
      { name: 'D', midi: 62 },
      { name: 'A', midi: 69 },
      { name: 'E', midi: 76 },
    ],
  },
]

export function getInstrument(id: InstrumentId): Instrument {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0]
}

export type ClosestStringMatch = {
  index: number
  string: InstrumentString
  /** Detected midi minus the string's midi. */
  semitoneDelta: number
}

/** Closest string by semitone distance; first match wins on ties (web parity). */
export function findClosestString(
  midi: number,
  strings: readonly InstrumentString[],
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
  return { index: bestIndex, string: stringDef, semitoneDelta: midi - stringDef.midi }
}
