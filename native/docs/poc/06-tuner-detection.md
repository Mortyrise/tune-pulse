# 06 — Tuner detection: low notes in "full" preset

Read `00-overview.md`, `01-core.md`, `02-tuner.md`, `05-mpm-fft.md` first.

## Device feedback (Android, user)

- Overall the native tuner works better than the browser one.
- Preset **light** (24 kHz requested, window 2048, lib resamples) catches low notes well.
- Preset **full** (device rate, likely 48 kHz, window 4096) does **not detect guitar string 6 (E2, 82.41 Hz)**.

## Hypothesis (to confirm, not assume)

At full bandwidth the low E's weak fundamental + strong upper harmonics + broadband noise push the NSDF key maximum's clarity below `clarityThreshold` 0.85 → `frequency: 0`. In light, the resampler's anti-alias low-pass (~12 kHz) removes that content. Other candidates to rule in/out: key-max picking choosing a harmonic and failing the threshold, tauMax/window coverage, actual delivered rate ≠ requested.

## Scope

1. **Reproduce in node first**: a synthetic "plucked guitar E2" generator in tests (weak fundamental, e.g. harmonics 2–8 stronger than h1, exponential decay, slight inharmonicity, white/pink noise, at 48 kHz) that fails with the current full settings and passes with light-equivalent processing. If you can't reproduce, say so and list what debug data we need from the device.
2. **Fix in the pipeline, keeping one code path**: e.g. anti-alias low-pass + decimation to ~12 kHz (or 11.025/12 depending on input rate) inside `src/core` before MPM, so every preset analyses a band-limited signal; and/or a lower clarity threshold for low frequencies with care for false positives. Justify the choice with the test results. Keep the max detectable note ≥ C8 (4186 Hz) or state the new limit.
3. Make the fixed pipeline the default in `src/audio/tuner.ts`; keep a preset toggle only if it still teaches us something (state it). The screen (owned by 07) reads presets from `tuner.ts` — if you rename/remove presets, export a `TUNER_PRESETS` list the screen can render and note it under "Requests to other tasks".
4. Expose raw per-analysis debug (frequency, clarity, rms even when rejected) through the existing stats so the device can show why a note is rejected.

## Ownership

`src/core/*` (all), `src/audio/tuner.ts`. Do **not** edit `src/hooks/useTuner.ts` or `src/screens/TunerScreen.tsx` (owned by 07, running in parallel).

## Acceptance

- New test reproduces the failure on the old pipeline and passes on the new one; all existing tests pass; `npx tsc --noEmit` clean.
- Per-analysis cost on Node reported (must stay well under 2 ms at default settings).

## Plan

**What "light" really gets (lib source).** `AudioRecorderCallback::prepare` resamples only when the requested rate differs from the stream rate. It uses r8brain `CDSPResampler24`, which is linear-phase, has a 2 % transition band and about 200 dB of stopband attenuation. So 48k→24k is a near-brick-wall low-pass at about 11.7 kHz, and nothing else changes: same gain, same 85 ms window, same tauMax (1600 vs 800 = 33 ms). The Oboe stream itself opens at the device rate (no `setSampleRate`, `PerformanceMode::None`, Exclusive). "full" requests the device rate, so it usually gets no resampling and the full 0–24 kHz band.

**Reproduction (node, scratch scripts, current `mpm.ts`).**
- Test signal: plucked E2 at 48 kHz. Partial 1 at 0.3, partials 2–8 at 1.0, then a (8/k)^1.5 rolloff. Per-partial decay 0.5+0.15k /s, inharmonicity B=1e-4, a 120 Hz 2nd-order mic high-pass, peak 0.3, plus white noise. Frames counted between 0.2 and 2.0 s. "light" is emulated with a windowed-sinc low-pass at 11.5 kHz followed by ↓2.
- Detection rate within ±50 ¢:

  | white noise σ | full48 | light24 | 48k + 5 kHz LP (proposed) |
  |---|---|---|---|
  | 0.003 | 98 % | 98 % | 95 % (one more frame below the rms gate) |
  | 0.005 | 86 % | 100 % | 98 % |
  | 0.008 | 62 % | 81 % | 100 % |
  | 0.012 | 40 % | 60 % | 83 % (3 kHz: 95 %) |

- Every failure is a clarity rejection: median clarity of the rejected frames is 0.63–0.82, just under 0.85. None were octave errors, and the rms gate was not the cause.
- Without noise, everything passes: weak or missing fundamental, the 150 Hz high-pass, B up to 3e-4.
- **The hypothesis holds in kind.** NSDF clarity is about SNR/(1+SNR). White noise above 12 kHz doubles the noise power (3 dB) and pushes borderline frames under 0.85.
- **Not proven:** that 3 dB explains "light catches it, full never does" on the phone. That needs either strong HF content on the device (hiss, or a ~15–20 kHz electronic tone) or something else. Device stats below will settle it.
- Bright tone + B=3e-4 is still limited to about 55 % even when band-limited, because inharmonic partials decorrelate at lag T. That is a separate, smaller effect.

**Second bug found (high notes).** `detectPitch` skips the "initial positive region" starting at tauMin, not at τ=0. When T is close to tauMin, the first real peak is swallowed. With 4 harmonics, current results:

| | C7 2093 Hz | A7 3520 Hz | C8 4186 Hz |
|---|---|---|---|
| full48 | OK | OK | −1200 ¢ |
| light24 | −1200 ¢ | −12.7 ¢ | −15 ¢ |

So "≥ C8" is not met today in either preset. 48k + 5 kHz LP + the scan fix gives |err| ≤ 0.5 ¢ for 82–4186 Hz at 48k and 44.1k.

**Fix design (one code path, all inside `MpmDetector`).**
- **Filter:** new `src/core/biquad.ts`, a 4th-order Butterworth low-pass built from 2 cascaded biquads (bilinear transform, Float64 state). It is applied in `push()` before the ring, so it is stateful across chunks, and `reset()` clears it. New option `lowpassHz` (default 5000; 0 turns it off; it is also turned off automatically when ≥ 0.45·sr). Rms and the gate see the filtered signal.
- **Why IIR, and why no decimation:**
  - Pitch only needs periodicity; the IIR phase shift doesn't change the period.
  - Group delay is about 0.08 ms, so no added latency to speak of.
  - Cost is about 0.017 ms per 2048-sample chunk on Node, roughly 5 % of one analysis.
  - Decimating to 12k or 16k (the doc's suggestion) gives the same noise gain but costs high-note accuracy: −15 ¢ at C7 at 12k, and octave errors at 16k, from short-lag parabolic interpolation. Decimation per input rate is therefore **none**: the filter is designed from the actual sr (44.1/48/96k all work).
  - New top note: C8 verified; usable up to about 4.5 kHz (−0.5 dB at 4186 Hz). `maxFreq` stays 5000.
- **Scan fix:** compute NSDF from τ=1 (free on the FFT path; the direct path loops from 1 so fft and direct still match), skip the lag-0 lobe from τ=1, and keep only key maxima with τ ≥ tauMin.
- **Clarity threshold** stays at 0.85. With the filter, low-pass-filtered white or pink noise gives 0 voiced frames out of 466 (max clarity 0.17 white, 0.47 pink), so there is margin. A frequency-dependent threshold is not needed for the reproduced case, so it stays out to avoid false positives.

**Presets (`src/audio/tuner.ts`).** Every preset goes through the same filtered detector. `full` (device rate, window 4096) is the default. Export `TUNER_PRESETS: readonly { id: TunerPreset; label: string }[]`.
- Keep `light` only as a CPU fallback until Hermes ms/analysis is known.
- Add a diagnostic `raw` preset (`lowpassHz: 0` = old pipeline) for one device A/B. If full and raw catch E2 equally well on the phone, noise isn't the cause.
- Plan to drop `light` and `raw` after the device run.

**Debug stats.** `MpmDetector.lastDebug`: `{ rawFrequency /* candidate even when rejected */, clarity, rms, rmsUnfiltered, voiced, reason: 'gate'|'clarity'|'nopeak'|'ok' }`. `rmsUnfiltered` costs one extra sum of squares; 1 − (rms/rmsUnfiltered)² is the energy fraction above 5 kHz, which directly tests the HF hypothesis on the device. `TunerStats` gains `last` (that object) plus counters `voiced`, `rejGate`, `rejClarity`, `rejNoPeak`. `PitchSample` stays unchanged.

**Tests (vitest, `src/core`).**
- `testSignals.ts`: a seeded plucked-E2 generator and a windowed-sinc ↓2 helper for the light emulation.
- `detection.test.ts`:
  - E2 + σ 0.008 at 48k/4096: old pipeline (`lowpassHz: 0`) is below 75 %, the new one is at least 95 %, light emulation is at least 80 %.
  - 82–4186 Hz with harmonics at 44.1 and 48k: within 1 ¢ (C8 fails on the old pipeline).
  - White and pink noise: 0 voiced frames.
  - Filter: −3 dB at fc, state continuity (chunked output = one-shot output), `reset()`.
  - Existing tests keep their tolerances; fft and direct still match.
- Benchmark: ms/analysis with the filter included (target < 0.5 ms on Node at 4096). Then run `npx tsc --noEmit`.

## Requests to other tasks

**For 07 (contract, fixed — code against these names):**

```ts
// src/audio/tuner.ts
export type TunerPreset = 'full' | 'light' | 'raw'
export type TunerPresetInfo = { id: TunerPreset; label: string; description: string }
export const TUNER_PRESETS: readonly TunerPresetInfo[]   // order: full, light, raw; full is default
export const DEFAULT_TUNER_PRESET: TunerPreset            // 'full'
// TunerInfo gains: lowpassHz: number (0 = off), rmsThreshold: number
// TunerStats gains:
//   voiced: number; rejGate: number; rejClarity: number; rejNoPeak: number  // counters since start
//   last: MpmDebug | null                                                   // newest analysis, even if rejected
// src/core/mpm.ts
export type MpmRejectReason = 'ok' | 'gate' | 'clarity' | 'nopeak'
export type MpmDebug = {
  rawFrequency: number   // Hz of the chosen key maximum even when rejected (0 if gate/nopeak)
  clarity: number
  rms: number            // filtered signal (what the gate sees)
  rmsUnfiltered: number  // before the low-pass; HF energy fraction = 1 − (rms/rmsUnfiltered)²
  reason: MpmRejectReason
}
```
`startTuner(onSample, { preset })` and `PitchSample` are unchanged. Suggested debug line: `reason · raw 82.3 Hz · clar 0.81 · rms 0.004/0.006 (HF 55 %) · v/g/c/n counts`.

## Result

**Lead's answers applied:** three presets: `full` (filtered, the default), `raw` (filter off, for a device A/B) and `light` (filtered, CPU fallback). The cutoff is 5 kHz, the debug fields are exposed, and the default RMS gate is lowered and configurable. The contract for 07 is in "Requests to other tasks" above and matches the code exactly.

**Files**
- **New `src/core/biquad.ts`:** `ButterworthLowpass(sr, fc, order = 4)`, built from cascaded biquads (bilinear transform, Float64 state). It is stateful across `process()` calls and has `reset()`.
- **`src/core/mpm.ts`:**
  - New options:
    - `lowpassHz`: default 5000. 0 turns it off, and it also turns itself off when the cutoff is ≥ 0.45·sr, so 8 k and 11.025 k run unfiltered.
    - `rmsThreshold`: default lowered from 0.01 to **0.003**.
  - The input is filtered in `push()` before the ring buffer. A second, unfiltered ring is kept only when the filter is on, to report `rmsUnfiltered`.
  - **τ-scan fix:** the NSDF is now filled from τ=1 on both the fft and direct paths, the lag-0 lobe is skipped from τ=1, and only key maxima with τ ≥ tauMin are kept.
  - New `lastDebug: MpmDebug` (one object, mutated in place) and a `lowpassHz` getter. New exports: `MpmDebug`, `MpmRejectReason`, `effectiveLowpassHz`. `PitchSample` and the existing API are unchanged.
- **`src/audio/tuner.ts`:**
  - `TunerPreset = 'full' | 'light' | 'raw'`, with `TUNER_PRESETS` and `DEFAULT_TUNER_PRESET`.
  - `raw` is the old pipeline: no filter and the 0.01 gate. The τ fix has no switch, but it doesn't affect E2.
  - `StartTunerOptions.rmsThreshold` overrides a preset's gate.
  - `TunerInfo` gains `lowpassHz` and `rmsThreshold`.
  - `TunerStats` gains `voiced`, `rejGate`, `rejClarity`, `rejNoPeak` and `last`. `last` is a fresh copy for each analysis, so the hook can hold or compare it safely.
  - Re-exports `MpmDebug` and `MpmRejectReason`.
- **New `src/core/testSignals.ts`:** seeded signal generators — plucked string, white/pink noise, harmonic tone, and a windowed-sinc ↓D that stands in for the recorder's resampler.
- **New `src/core/detection.test.ts`:** 29 tests.
- **`src/core/mpm.test.ts`:** the "sine below gate" amplitude changed from 0.005 to 0.002, because 0.005 now sits just above the new 0.003 gate.

**Results (from the tests)**
- **E2 pluck with σ 0.008 white noise, 48 kHz:**
  - Old pipeline: 62 % of frames detected; every miss is a `clarity` rejection.
  - Light emulation: 81 %.
  - New pipeline: 100 % (also ≥ 95 % at 44.1 kHz).
- **High notes, 4-harmonic tones from 82 Hz to C8, at 44.1 k and 48 k:** all within ±1 ¢. The old pipeline read C8 an octave low at 48 k; a regression test covers this.
- **Usable top note:** about 4.5 kHz. The filter is at −0.87 dB at 4186 Hz (bilinear warping; the plan said −0.5 dB).
- **Noise only:** white and pink noise at σ 0.002 / 0.008 / 0.05 give 0 voiced frames out of more than 200, with max clarity below 0.6 (0.16 white, 0.41 pink). This held for every gate down to 0.001. The noise-only test therefore doesn't limit the gate; I took 0.003, the low end of your range.
- **Sustain gain** (end of the first unbroken run of correct detections, decaying E2 in a quiet room, σ 0.0005):

  | Pluck peak level | 0.01 gate | 0.003 gate | gain |
  |---|---|---|---|
  | 0.3 | 2.01 s | 3.33 s | **+1.3 s** |
  | 0.1 | 0.98 s | 2.13 s | **+1.15 s** |
  | 0.05 | 0.43 s | 1.45 s | **+1.0 s** |

  The filter alone does not change sustain. A test asserts a gain of at least 1 s.
- **Cost** (Node/V8, tuner cadence = 2048 hop, 4096 window @ 48 k): 0.42 ms per push with the filter vs 0.37 ms without. The benchmark (filter on) reports fft at 0.285 ms mean for 4096 and 0.129 ms for 2048. Well under 2 ms.

**Checks:** `npx tsc --noEmit` exits 0 with no errors in any file, 07's included. `npx vitest run` (all suites, 07's included): 7 files, 167/167 pass.

**For a later web fix:** the web worklet `src/audio/worklets/mpm-processor.js` has the same τ-scan bug: it skips the initial positive region starting at tauMin, so notes near maxFreq (C8 at 48 k) read an octave low. It also has no input low-pass. The same two changes would apply there.

**Risks and what to check on the device**
- The 0.003 gate doesn't let noise through, but a quiet *periodic* background now gets past the gate and may show a note while the user isn't playing: fan hum, mains hum harmonics, a fridge. The clarity gate still applies. If this shows up, raise the gate with `StartTunerOptions.rmsThreshold`.
- **Device A/B:** play the low E string in `full` and then `raw`, and record `last.reason`, `clarity`, `rawFrequency`, `rms` / `rmsUnfiltered` and the rejection counters.
  - If `raw` misses with `reason: 'clarity'` and `full` catches the note, the noise hypothesis is confirmed.
  - HF energy fraction = 1 − (rms/rmsUnfiltered)². A high value in silence means the mic has strong noise above 5 kHz.
  - If both presets miss with `reason: 'gate'`, the input level is the problem, not noise.
- Hermes ms/analysis is still unmeasured; `light` stays in as the CPU fallback.
