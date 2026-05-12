// Metronome scheduler — Phase 2 will implement the Chris Wilson lookahead pattern:
//
//   - A setInterval at SCHEDULE_INTERVAL_MS (~25ms) wakes up
//   - It schedules every click whose time falls within the next LOOKAHEAD_MS (~100ms)
//   - Clicks are scheduled via OscillatorNode + GainNode envelope at exact
//     audioContext.currentTime + offset (sample-accurate)
//
// This decouples audio timing from JS event loop jitter.

export const SCHEDULE_INTERVAL_MS = 25
export const LOOKAHEAD_MS = 100

export type Subdivision = 1 | 2 | 3 | 4 // quarter, eighths, triplets, sixteenths

export type BeatConfig = {
  /** which beats are accented (1-indexed). [1] = downbeat only */
  accents: number[]
  /** subdivision per beat (length = numerator). e.g. [1,2,1,2] = quarter,eighths,quarter,eighths */
  subdivisions: Subdivision[]
}

export type MetronomeConfig = {
  bpm: number
  numerator: number
  denominator: number
  beats: BeatConfig
}

export const DEFAULT_METRONOME: MetronomeConfig = {
  bpm: 100,
  numerator: 4,
  denominator: 4,
  beats: {
    accents: [1],
    subdivisions: [1, 1, 1, 1],
  },
}
