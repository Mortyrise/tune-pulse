# 16 — Web PWA: detection parity with native

Read `00-overview.md`, `../poc/05-mpm-fft.md`, `../poc/06-tuner-detection.md` (Results).

## Scope (web app at repo root only)
- Port to the web worklet `src/audio/worklets/mpm-processor.js` the native detection fixes from `native/src/core/` (`mpm.ts`, `biquad.ts`, `fft.ts`): the τ-scan bug fix (high notes read an octave low), the 5 kHz 4th-order low-pass before analysis, the lower RMS gate (0.003), and optionally the FFT NSDF (the worklet runs on the audio thread at ~94 analyses/s — measure whether FFT is needed; justify).
- Worklets can't import modules: either inline the code or build the worklet from TS via Vite (check how `?url` import is set up in `src/audio/pitchDetector.ts`). Prefer one source of truth if Vite can bundle the worklet cleanly; otherwise inline and add a test that compares worklet output with the native core on the same signals (vitest is not set up at the root — report if you need it; no installs).
- Web `useTuner`/screen: no behaviour changes beyond what the detector needs (e.g. constants).

## Acceptance
`npm run build` and `npm run lint` clean at the root; evidence (test or script output) that the web detector now matches native on E2-in-noise and C8.

## Plan

**Decision: one source of truth. The web worklet is built by Vite from TS and imports `native/src/core/mpm.ts` as is.** Evidence (vite 8.0.12 / rolldown from the root `node_modules`, scratch project with copies of `mpm/biquad/fft.ts`):
- `import url from './worklets/mpm-processor.ts?worker&url'` is declared in `vite/client.d.ts` (`*?worker&url` → `string`). In a build, `webWorkerPlugin` runs `bundleWorkerEntry` (a separate rolldown build, `worker.format` default `iife`) and emits one 7.0 kB `assets/mpm-processor-[hash].js`: `(function(){…registerProcessor(…)})()`, with mpm+biquad+fft inlined and no `self`/`window`/`document`/`import.meta`. So it is safe in `AudioWorkletGlobalScope`, and `addModule` accepts it.
- In dev, the URL is `…/mpm-processor.ts?worker_file&type=module`. It is served as ESM with `import "/@fs/…/vite/dist/client/env.mjs"` (worklet-safe: it uses `globalThis`) plus `import … from "/native/src/core/mpm.ts"`. `addModule` supports static ESM imports. Checked with curl against `vite` dev; not yet in a browser.
- `new URL('./x.ts', import.meta.url)` would only copy the file as an asset without compiling it, and a separate rollup input is unnecessary. Both rejected.
- `tsc` with `tsconfig.app.json` options on a worklet that imports the real `native/src/core/mpm.ts` exits 0 (erasableSyntaxOnly, verbatimModuleSyntax and noUnusedLocals are all fine). TS 6.0.3 has no AudioWorklet lib, so the worklet declares `sampleRate`, `AudioWorkletProcessor` and `registerProcessor` locally with module-scoped `declare`.

**Changes (web files only)**
1. Replace `src/audio/worklets/mpm-processor.js` with `src/audio/worklets/mpm-processor.ts`, about 25 lines: `class extends AudioWorkletProcessor { det = new MpmDetector(sampleRate) }`. `process()` pushes `inputs[0][0]` (128-sample quanta), and when `push()` returns a sample it does `port.postMessage({frequency, clarity, rms})`. The message contract and the per-hop cadence (every 512 samples, including gated frames) are unchanged. No option overrides: native defaults are the web constants (4096/512/30–5000 Hz/0.85/0.93) plus the fixes.
2. In `src/audio/pitchDetector.ts`, change one import line to `./worklets/mpm-processor.ts?worker&url`. `useTuner.ts` and `TunerScreen` need no changes (no web constant depends on the gate).

**Fixes ported (all of them, for free, through the shared `MpmDetector`)**
- The τ-scan fix (fill from τ=1, keep key maxima with τ ≥ tauMin).
- The 5 kHz 4th-order Butterworth low-pass.
- The rms gate lowered to 0.003.
- The FFT NSDF.

**FFT: yes.** Measured in Node/V8 on the built bundle, 48 kHz, E2 plus noise, 128-sample quanta:
- Old worklet (direct loop, 4096 × ~1600 lags): **7.2 ms per analysis**. At 93.75 analyses/s that is about 68 % of a core. Worse, every 4th 128-sample render quantum (2.67 ms budget) overruns by about 2.7×, on the same audio thread the metronome uses.
- New worklet (FFT + low-pass): **0.46 ms per analysis**, about 4 % of a core, and it fits in a quantum.
- Even without the single-source argument, the FFT path is needed.

**Parity proof (no root vitest, no installs).** New `scripts/check-worklet-parity.mjs`, plain Node 22.20:
- It uses `module.registerHooks` to resolve the extensionless `.ts` imports, and Node's built-in type stripping to import `native/src/core/{mpm,testSignals}.ts`.
- It loads the **built** `dist/assets/mpm-processor-*.js` in a `node:vm` context with stub `sampleRate`, `AudioWorkletProcessor` and `registerProcessor`, and feeds 128-sample quanta.
- It compares this with native `MpmDetector` fed the same way, and with the HEAD worklet (via `git show`) as a baseline.
- It exits non-zero on a mismatch.

Prototype output (scratch build):
- E2 (σ 0.008, frames in 0.2–2 s): old 66.3 % → new 100 %, native 100 %.
- C8 @ 48 k: old 0 % (octave low, about 1201 ¢) → new 100 %, max 0.24 ¢.
- Native vs worklet: max abs diff **0** (bit-identical) over 206 and 93 frames.

**Verification**
- Root: `npm run build` (tsc -b, then vite build; check that the worklet chunk is emitted and precached by the PWA), `npm run lint`, then `node scripts/check-worklet-parity.mjs`, with its output pasted into Result.
- `native/`: `npx vitest run src/core` as a sanity run. No native files are edited.
- Risk: if `tsc -b` complains about files outside `include`, add the three core files to `tsconfig.app.json`'s `include`.
- A browser smoke test (`npm run dev`, tuner screen, Chrome) is for the user, since I can't drive a mic here.


## Result

**Done as planned.** The coordinator's answers are applied: import from `native/src/core`, a guard header in the shared files, the script committed together with `npm run check:worklet`. `tsconfig.app.json` didn't need changing, because `tsc -b` follows the imports.

**Files**
- **Deleted** `src/audio/worklets/mpm-processor.js` (the hand-written MPM).
- **New `src/audio/worklets/mpm-processor.ts`** (about 30 lines):
  - `new MpmDetector(sampleRate)` with native defaults.
  - `process()` pushes each 128-sample quantum and posts `{frequency, clarity, rms}` once per 512-sample hop, gated frames included. Same contract and cadence as before.
  - Local `declare`s for the AudioWorklet globals.
- **`src/audio/pitchDetector.ts`:** the import is now `./worklets/mpm-processor.ts?worker&url`. No other changes.
- **`native/src/core/{mpm,biquad,fft}.ts`:** a 4-line header comment only. It says the files are shared with the web worklet, must stay free of react-native/Expo/DOM/Node imports, and are checked by `npm run check:worklet`.
- **New `scripts/check-worklet-parity.mjs`** and the root `package.json` script `"check:worklet"`. Node ≥ 22.18; no dependencies.
  - It fails (exit 1) if `dist/assets/mpm-processor-*.js` is missing or duplicated.
  - It fails if the bundle references `window`, `document`, `self`, `import.meta` or `require`.
  - It fails if the bundle throws on load or doesn't register `mpm-processor`.
  - It fails if any frame differs from native, or if the E2 ≥ 95 % / C8 ±1 ¢ acceptance fails.
  - I checked the missing-build path: it exits 1 with "Run `npm run build` first".
- `useTuner.ts` and `TunerScreen` are unchanged.

**Parity (`npm run build && npm run check:worklet`).** Hit rate = frames within ±50 ¢ over 0.2–2 s:

| Signal | old worklet | new worklet | native core | worklet vs native |
|---|---|---|---|---|
| E2 pluck + noise σ 0.008 @ 48 k | 66.3 % | **100 %** | 100 % | 206/206 frames, max abs diff **0** |
| E2 pluck + noise σ 0.008 @ 44.1 k | 69.7 % | **100 %** | 100 % | 189/189, diff 0 |
| C8 @ 48 k | 0 % (≈ 1201 ¢, octave low) | **100 %, max 0.24 ¢** | same | 93/93, diff 0 |
| C8 @ 44.1 k | 0 % (≈ 1199 ¢) | **100 %, max 0.33 ¢** | same | 86/86, diff 0 |

- The old worklet comes from `13ecc7b` via `git show`.
- The old web worklet also read C8 an octave low at 44.1 k, not only at 48 k.

**Cost at 48 k, 93.75 analyses/s (V8 in Node, WSL):**
- Old worklet: 7.2–10.5 ms per analysis, about 68–99 % of a core. Each analysis overran the 2.67 ms render quantum.
- New worklet: 0.46–0.63 ms per analysis, about 4–6 % of a core.

**Checks**
- `npm run build`:
  - `tsc -b` and the vite build are clean.
  - It emits `dist/assets/mpm-processor-[hash].js` (7.05 kB, a self-contained iife).
  - The PWA precache (`sw.js`) includes it.
- `npm run lint`: clean.
- `npm run check:worklet`: passes.
- `native/`:
  - `npx vitest run src/core`: 7 files, 152/152 pass.
  - `npx tsc --noEmit`: exit 0.

**Not verified here:**
- A real browser with a mic, for the user: `npm run dev`, tuner, then the low E string and a high note, in Chrome and ideally Safari/iOS.
- Dev mode serves the worklet as ESM with static imports (`addModule` supports this). I checked it only by curl during planning.
- Same risk as native: with the 0.003 gate, quiet periodic background hum may now show a note.
