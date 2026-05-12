export type Notation = 'english' | 'latin'
export type Accidental = 'sharp' | 'flat'

const SHARP_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLAT_EN = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const
const SHARP_LA = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'] as const
const FLAT_LA = ['Do', 'Reb', 'Re', 'Mib', 'Mi', 'Fa', 'Solb', 'Sol', 'Lab', 'La', 'Sib', 'Si'] as const

export const REFERENCE_PITCH = 440 // A4
const A4_MIDI = 69

export type DetectedNote = {
  frequency: number
  midi: number
  noteIndex: number
  octave: number
  cents: number
}

export function frequencyToNote(frequency: number, referenceA4 = REFERENCE_PITCH): DetectedNote | null {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null
  }
  const midiFloat = 12 * Math.log2(frequency / referenceA4) + A4_MIDI
  const midi = Math.round(midiFloat)
  const cents = (midiFloat - midi) * 100
  const noteIndex = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return { frequency, midi, noteIndex, octave, cents }
}

export function formatNoteName(
  noteIndex: number,
  notation: Notation = 'english',
  accidental: Accidental = 'sharp',
): string {
  if (notation === 'latin') {
    return (accidental === 'flat' ? FLAT_LA : SHARP_LA)[noteIndex]
  }
  return (accidental === 'flat' ? FLAT_EN : SHARP_EN)[noteIndex]
}
