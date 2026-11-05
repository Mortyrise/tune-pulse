import { describe, expect, it } from 'vitest'
import {
  formatNoteName,
  frequencyToNote,
  midiToFrequency,
  octaveFromMidi,
  splitNoteName,
} from './notes'

describe('frequencyToNote', () => {
  it('maps A4 = 440 Hz to midi 69 with 0 cents', () => {
    const n = frequencyToNote(440)!
    expect(n.midi).toBe(69)
    expect(n.noteIndex).toBe(9)
    expect(n.octave).toBe(4)
    expect(n.cents).toBeCloseTo(0, 9)
  })

  it('reports cents offsets', () => {
    expect(frequencyToNote(440 * Math.pow(2, 10 / 1200))!.cents).toBeCloseTo(10, 6)
    expect(frequencyToNote(440 * Math.pow(2, -30 / 1200))!.cents).toBeCloseTo(-30, 6)
  })

  it('honours a custom reference pitch', () => {
    const n = frequencyToNote(442, 442)!
    expect(n.midi).toBe(69)
    expect(n.cents).toBeCloseTo(0, 9)
    expect(frequencyToNote(440, 442)!.cents).toBeLessThan(0)
  })

  it('maps E2 and low C correctly', () => {
    const e2 = frequencyToNote(82.41)!
    expect(e2.midi).toBe(40)
    expect(formatNoteName(e2.noteIndex)).toBe('E')
    expect(e2.octave).toBe(2)
    const c4 = frequencyToNote(261.63)!
    expect(c4.noteIndex).toBe(0)
    expect(c4.octave).toBe(4)
  })

  it('returns null for invalid input', () => {
    expect(frequencyToNote(0)).toBeNull()
    expect(frequencyToNote(-1)).toBeNull()
    expect(frequencyToNote(NaN)).toBeNull()
    expect(frequencyToNote(Infinity)).toBeNull()
  })
})

describe('formatNoteName', () => {
  it('supports english/latin and sharp/flat', () => {
    expect(formatNoteName(1)).toBe('C#')
    expect(formatNoteName(1, 'english', 'flat')).toBe('Db')
    expect(formatNoteName(7, 'latin')).toBe('Sol')
    expect(formatNoteName(10, 'latin', 'flat')).toBe('Sib')
    expect(formatNoteName(8, 'latin', 'sharp')).toBe('Sol#')
  })
})

describe('midiToFrequency / octaveFromMidi', () => {
  it('round-trips with frequencyToNote', () => {
    for (let midi = 21; midi <= 108; midi++) {
      expect(frequencyToNote(midiToFrequency(midi))!.midi).toBe(midi)
    }
    expect(midiToFrequency(69)).toBe(440)
    expect(midiToFrequency(57)).toBeCloseTo(220, 9)
    expect(midiToFrequency(69, 442)).toBe(442)
  })

  it('computes octaves', () => {
    expect(octaveFromMidi(60)).toBe(4)
    expect(octaveFromMidi(59)).toBe(3)
    expect(octaveFromMidi(12)).toBe(0)
  })
})

describe('splitNoteName', () => {
  it('splits accidentals', () => {
    expect(splitNoteName('C#')).toEqual({ base: 'C', accidental: '♯' })
    expect(splitNoteName('Bb')).toEqual({ base: 'B', accidental: '♭' })
    expect(splitNoteName('Sib')).toEqual({ base: 'Si', accidental: '♭' })
    expect(splitNoteName('B')).toEqual({ base: 'B', accidental: null })
    expect(splitNoteName('Do')).toEqual({ base: 'Do', accidental: null })
  })
})
