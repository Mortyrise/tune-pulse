import { describe, expect, it } from 'vitest'
import { clarityPercent, errorCopy, idleHint, noteParts, stringDeltaLabel } from './format'
import { centsTone, toneColor } from './display'
import { THEME_COLORS } from '../theme/tokens'

describe('noteParts', () => {
  it('splits sharps, flats and latin names with octave', () => {
    expect(noteParts(70, 'english', 'sharp')).toEqual({ base: 'A', accidental: '♯', octave: 4 })
    expect(noteParts(70, 'english', 'flat')).toEqual({ base: 'B', accidental: '♭', octave: 4 })
    expect(noteParts(67, 'latin', 'sharp')).toEqual({ base: 'Sol', accidental: null, octave: 4 })
    expect(noteParts(40, 'english', 'sharp')).toEqual({ base: 'E', accidental: null, octave: 2 })
  })
})

describe('stringDeltaLabel', () => {
  it('shows cents on the string and semitones off it', () => {
    expect(stringDeltaLabel(0, 3.4)).toBe('+3¢')
    expect(stringDeltaLabel(0, -2.6)).toBe('-3¢')
    expect(stringDeltaLabel(0, 0)).toBe('+0¢')
    expect(stringDeltaLabel(2, 10)).toBe('+2st')
    expect(stringDeltaLabel(-1, 10)).toBe('-1st')
  })
  it('is empty without a note', () => {
    expect(stringDeltaLabel(null, null)).toBe('')
    expect(stringDeltaLabel(0, null)).toBe('')
  })
})

describe('idleHint', () => {
  it('reflects the settings', () => {
    expect(idleHint('Chromatic', 440, 5)).toBe('Chromatic · A4 = 440 Hz · in-tune within ±5¢')
    expect(idleHint('Guitar', 442, 10)).toBe('Guitar · A4 = 442 Hz · in-tune within ±10¢')
  })
})

describe('clarityPercent', () => {
  it('rounds and clamps', () => {
    expect(clarityPercent(0.924)).toBe(92)
    expect(clarityPercent(1.2)).toBe(100)
    expect(clarityPercent(-1)).toBe(0)
    expect(clarityPercent(null)).toBe(0)
    expect(clarityPercent(NaN)).toBe(0)
  })
})

describe('errorCopy', () => {
  it('offers Settings only for denied', () => {
    expect(errorCopy('denied', 'x')).toMatchObject({ title: 'Microphone blocked', canOpenSettings: true })
    expect(errorCopy('other', 'boom')).toEqual({ title: 'Microphone error', body: 'boom', canOpenSettings: false })
    expect(errorCopy('weird', '').canOpenSettings).toBe(false)
  })

  it('has its own copy for interruptions', () => {
    expect(errorCopy('interrupted', 'call')).toEqual({ title: 'Tuner paused', body: 'call', canOpenSettings: false })
  })
})

describe('toneColor', () => {
  it('maps tones to each theme token', () => {
    for (const colors of Object.values(THEME_COLORS)) {
      expect(toneColor(centsTone(2, 5), colors)).toBe(colors.good)
      expect(toneColor(centsTone(12, 5), colors)).toBe(colors.warn)
      expect(toneColor(centsTone(-20, 5), colors)).toBe(colors.bad)
    }
  })
})
