// Pure display helpers for the metronome screen (ported from the web MetronomeScreen).
import type { BeatEvent, CountInBars, Denominator } from '../audio/metronomeLayout'

export const NUMERATOR_CHOICES = [2, 3, 4, 5, 6, 7, 8, 9, 12] as const

export const NOTE_LABEL_BY_DENOM: Record<Denominator, string> = {
  2: '𝅗𝅥',
  4: '♩',
  8: '♪',
  16: '𝅘𝅥𝅯',
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function nextCountIn(current: CountInBars): CountInBars {
  return current === 0 ? 1 : current === 1 ? 2 : 0
}

export function countInLabel(value: CountInBars): string {
  return value === 0 ? 'off' : value === 1 ? '1 bar' : '2 bars'
}

/** 1-based pattern bar for the session strip; 0 while idle or counting in. */
export function displayedBar(activeBeat: BeatEvent | null, countInBars: number, isRunning: boolean): number {
  if (!isRunning || !activeBeat || activeBeat.phase === 'count-in') return 0
  return Math.max(0, activeBeat.barIndex - countInBars) + 1
}

/** Brand dot period: idle 2 s; running = 2 beats (handoff: sync to half the beat period). */
export function brandPulseMs(bpm: number, isRunning: boolean): number {
  return isRunning ? Math.round((60_000 / bpm) * 2) : 2000
}

export function patternSummary(c: { bpm: number; numerator: number; denominator: number }): string {
  return `${c.bpm} · ${c.numerator}/${c.denominator}`
}
