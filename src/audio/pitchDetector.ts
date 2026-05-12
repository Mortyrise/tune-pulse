// Pitch detection — Phase 2 will implement MPM (McLeod Pitch Method) running
// inside an AudioWorklet for low-latency, sample-accurate analysis.
//
// Planned flow:
//   1. Mic stream -> MediaStreamAudioSourceNode
//   2. -> AudioWorkletNode (mpm-processor.js) — accumulates 2048-sample frames
//   3. Worklet runs NSDF (Normalized Square Difference Function) + peak picking
//   4. Posts { frequency, clarity } back via port.postMessage
//   5. Main thread maps frequency -> note + cents via lib/notes.ts
//
// Onset detection: gate output by RMS threshold so silence/noise doesn't spam
// the UI with garbage detections.

export type PitchResult = {
  frequency: number
  clarity: number // 0..1, confidence
  rms: number
}

export const PITCH_MIN_HZ = 30 // low B on a 5-string bass
export const PITCH_MAX_HZ = 5000 // well above any pitched instrument fundamental
export const CLARITY_THRESHOLD = 0.85
export const RMS_GATE = 0.01
