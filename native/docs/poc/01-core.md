# 01 — Core (pure TS): notes + MPM detector

Read `00-overview.md` first.

## Scope

- `src/core/notes.ts`: port `src/lib/notes.ts` from the web app (copy, keep API identical).
- `src/core/mpm.ts`: port the MPM algorithm from `src/audio/worklets/mpm-processor.js` into a pure, dependency-free TS class:
  - `MpmOptions { bufferSize: 4096; hopSize: 512; minFreq: 30; maxFreq: 5000; clarityThreshold: 0.85; rmsThreshold: 0.01; keyMaxRatio: 0.93 }` (defaults = web values).
  - `push(samples)` accepts arbitrary-length chunks (the native recorder may deliver 128…8192 frames), may produce at most one result per call (the latest analysis) — document the choice.
  - Same output semantics as the worklet: `{ frequency: 0, clarity, rms }` when silent/unclear.
  - No allocations in the hot path (preallocate typed arrays).
- Unit tests `src/core/mpm.test.ts`, `src/core/notes.test.ts` with vitest: synthetic sines (E2 82.41 Hz, A4 440, high E 1318.5 Hz) at 44100 and 48000 Hz → within ±1 cent; silence → frequency 0; sine + harmonics; chunk sizes 128 and 4096 give the same answer; noise → frequency 0 or low clarity.
- Add a `"test": "vitest run"` script? → no, package.json is shared: put the command in `## Result`; lead adds it.
- Measure: time per `analyze()` call in node for 4096 @ 48 kHz (rough benchmark in the test output or Result) — informs whether running on the JS thread is OK.

## Acceptance

- `npx tsc --noEmit` and `npx vitest run src/core` pass from `native/`.
- Algorithm is behaviourally identical to the worklet (same thresholds, peak picking, parabolic interpolation).

## Plan

**Files**: `src/core/mpm.ts` (implement stub), `src/core/mpm.test.ts`, `src/core/notes.test.ts` (new). `src/core/notes.ts` is already a verbatim copy of web `src/lib/notes.ts` (checked) — leave as is. No vitest config needed (pure TS, node env, explicit `import { describe, it, expect } from 'vitest'`). Note: `vitest` is not yet in `native/node_modules` (install still running) — tests can't run until it lands.

**API** (signatures unchanged from stub):
```ts
export type PitchSample = { frequency: number; clarity: number; rms: number }
export type MpmOptions = { bufferSize; hopSize; minFreq; maxFreq; clarityThreshold; rmsThreshold; keyMaxRatio } // all number
export const DEFAULT_MPM_OPTIONS: MpmOptions  // 4096/512/30/5000/0.85/0.01/0.93 (only addition)
export class MpmDetector {
  constructor(sampleRate: number, opts?: Partial<MpmOptions>) // throws on sampleRate<=0, bufferSize<2, hopSize<1
  push(samples: Float32Array): PitchSample | null
  reset(): void   // zero ring, writeIdx=0, samplesSinceAnalysis=0
}
```
Preallocated in ctor: `ring` Float32Array(N), `linear` Float32Array(N), `nsdf` Float32Array(tauMax+1), `peaks` Int32Array(tauMax+1) (replaces the worklet's `peaks = []`). `tauMin = max(2, floor(sr/maxFreq))`, `tauMax = min(N>>1, ceil(sr/minFreq))` — identical to worklet.

**push() with arbitrary chunk sizes**:
- If `len >= N`: only the last N samples matter → `ring.set(samples.subarray(len-N))`, `writeIdx = 0`.
- Else copy in at most two `ring.set(subarray)` segments (wrap-around), no per-sample modulo.
- `samplesSinceAnalysis += len`; if `>= hopSize` → reset to 0 and run **one** analysis on the latest N samples, return it; else `null`. This is exactly the worklet's rule (it also resets to 0, not `-= hop`), so a big chunk (e.g. 8192) yields one result for the newest window instead of several stale ones; with chunks ≤ hop it's one result every `ceil(hop/len)` pushes, same as the worklet with 128-frame quanta. Before the ring fills, analysis sees zero-padding (same as worklet; RMS gate usually suppresses it).
- `analyze()` (private): linearise ring via two `linear.set` copies, RMS over N; below `rmsThreshold` → `{frequency:0, clarity:0, rms}`; else NSDF + key-maxima + KEY_MAX_RATIO pick + clarity gate (`{frequency:0, clarity, rms}`) + parabolic interpolation, line-for-line with the worklet. Keep Float32 storage for nsdf/linear (same rounding as web). Only allocation per call is the returned 3-field result object (≤1 per push); not reusing a shared object because consumers may put it in React state.

**Tests** (`mpm.test.ts`, helpers: `sine(f, sr, n, amp, harmonics?)`, seeded mulberry32 noise, `centsOff(a,b)=1200*log2(a/b)`):
1. Pure sines E2 82.41, A4 440, E6 1318.51 × sr 44100/48000, amp 0.5, fed in 512-chunks for ≥ 2·N samples → |cents| ≤ 1, clarity > 0.85.
2. Silence (zeros) → frequency 0, clarity 0, rms 0.
3. Low-level sine (amp 0.005, rms < 0.01) → frequency 0.
4. Sine + harmonics (A2 110 Hz with 2nd/3rd/4th at 0.5/0.3/0.2, and E2) → fundamental within ±1 cent (no octave error).
5. Chunk sizes 128 vs 4096 vs 8192 on the same signal (total length multiple of 4096) → last result identical (`toBe` on frequency/clarity/rms).
6. Return cadence: 128-chunks → non-null exactly every 4th push; a 300-chunk pattern → non-null on the push crossing ≥512; one 8192 chunk → exactly one result.
7. White noise amp 0.3 → frequency 0 or clarity < 0.85 (seeded, deterministic).
8. `reset()` → next pushes behave as a fresh instance (same results as new detector).
9. Constructor: tauMin/tauMax bounds respected for sr 44100/48000 (via detected range: 30 Hz and 5000 Hz extremes not crashing; out-of-range 20 Hz → 0 or wrong-but-finite, just no throw).
`notes.test.ts`: A4→midi 69/0 cents, 440·2^(1/1200·10)→+10 cents, A=442 reference, invalid inputs → null, formatNoteName english/latin/sharp/flat, midiToFrequency round-trip, splitNoteName.

**Benchmark**: a `describe('benchmark')` test pushing a loud 440 Hz sine in 512-frame chunks at 48 kHz (each push = 1 analyze), warm-up 20, timed 200 with `performance.now()`, `console.log` mean/p95 ms per analyze; no assertion on time. Reported in `## Result` with the caveat that node/V8 JIT is far faster than Hermes (bytecode interpreter, no JIT).

**Risks**:
- **CPU on JS thread**: NSDF is O(N·tauMax) ≈ 5.3M MACs per analyze at 48 kHz (tauMax 1600). V8 maybe ~3-6 ms; Hermes could be 5-20× slower → may exceed the 10.7 ms hop budget. Mitigations for 02-tuner (not changing semantics here): larger recorder chunks (one analysis per callback), or `hopSize` 1024-2048 via opts; if still too slow, a follow-up could switch to FFT-based autocorrelation (would no longer be line-for-line identical to the worklet) or run on a worklet/worker thread.
- ±1 cent at E6/48 kHz (tau≈36) relies on parabolic interpolation accuracy; NSDF of a sine ≈ cos(ωτ) so error should be ≪1 cent, but if it fails I'll report rather than loosen the algorithm.
- vitest not installed yet; tsc will fail on test imports until it is.

## Result

**Done** (as planned):
- `src/core/mpm.ts`: `MpmDetector` + exported `DEFAULT_MPM_OPTIONS`; stub signatures unchanged. The analysis follows the worklet line for line. Ring buffer writes are block copies; a chunk ≥ bufferSize keeps its last N samples; the worklet's reset-to-0 hop rule gives at most one result per push. All typed arrays are preallocated; the only allocation is the returned result object.
- `src/core/notes.ts`: unchanged (already identical to web).
- `src/core/mpm.test.ts` (27 tests), `src/core/notes.test.ts` (8 tests).

**Verification** (from `native/`):
- `npx vitest run src/core` → 35/35 pass. Suggested script: `"test": "vitest run"` (core only: `vitest run src/core`).
- `npx tsc --noEmit` → exit 0, no errors in any file.
- Pitch accuracy: E2 82.41 / A4 440 / E6 1318.51 at 44.1 kHz and 48 kHz all within ±1 cent. Sines with harmonics (82.41/110/440 Hz) show no octave errors. Results are bit-identical across chunk sizes 128/4096/8192 and with odd 333-frame chunks that wrap the ring. Silence, sub-threshold input and seeded noise all gate correctly.

**Benchmark** (node v22 / V8 JIT, WSL, 440 Hz loud sine, one analyze per 512-frame push, 200 runs after 20 warm-up; see the console output with `npx vitest run src/core --silent=false -t benchmark`):

| bufferSize @ 48 kHz | tauMax | mean | p95 |
|---|---|---|---|
| 4096 (default) | 1600 | 10.8 ms | 16.5 ms |
| 2048 | 1024 | 2.6 ms | 3.4 ms |

**Implications for 02-tuner**: at 48 kHz a 512-sample hop lasts 10.7 ms. Even on V8 with JIT the default config uses the whole hop, and Hermes (no JIT) will likely be several times slower. So running at the default hop on the JS thread is **not viable**. Options, best first:
1. Keep 4096 but analyse only about 10–15 times a second: pass a large `hopSize` (e.g. 4096) or use large recorder chunks, since a push gives at most one result.
2. Use bufferSize 2048 (about 4× cheaper). The trade-off is that tauMax is capped at N/2 = 1024, so the lowest detectable note is about 47 Hz at 48 kHz (43 Hz at 44.1 kHz). E2 (82 Hz) is still fine.
3. If Hermes is still too slow on device, a follow-up could use FFT-based autocorrelation (no longer identical to the worklet) or move analysis off the JS thread.

**Not verifiable here**: timing under Hermes on a real device. 02-tuner should log the time per push on device.
