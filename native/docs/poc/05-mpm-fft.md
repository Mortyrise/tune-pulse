# 05 — MPM fast path: FFT autocorrelation

Read `00-overview.md` and `01-core.md` (incl. its `## Result`) first.

## Why

01-core benchmark (Node/V8, 48 kHz): 10.8 ms mean per analysis with window 4096 (O(N·tauMax) ≈ 6.5 M MACs). Hermes has no JIT and is expected to be 5–20× slower → 50–200 ms per analysis on device, far over the ~43 ms between recorder callbacks in 02-tuner. We need the same algorithm, much cheaper.

## Scope

- In `src/core/mpm.ts` (ownership transferred from 01 to 05), compute the NSDF in O(N log N):
  - ACF `r(τ)` via real FFT of the window zero-padded to ≥ 2N (power of two), power spectrum, inverse FFT.
  - `m(τ)` via the standard incremental recurrence: `m(0) = 2·Σx²`, `m(τ) = m(τ−1) − x[τ−1]² − x[N−τ]²`.
  - `nsdf(τ) = 2·r(τ) / m(τ)`; everything after (key maxima, KEY_MAX_RATIO, clarity gate, parabolic interpolation) unchanged.
  - Own small radix-2 FFT in a new file `src/core/fft.ts` (no dependency), preallocated twiddles/bit-reversal tables, zero allocations in the hot path. Use Float64Array for the FFT accumulators to keep precision.
- Keep the naive NSDF available (e.g. `opts.method: 'fft' | 'direct'`, default `'fft'`) so tests can compare both.
- Tests: extend `src/core/mpm.test.ts` / add `src/core/fft.test.ts` — FFT vs naive DFT on random input; NSDF fft vs direct max abs diff < 1e-4 on sines/noise; all existing 01 tests pass with the default method; frequency results within 0.1 cent of the direct method.
- Benchmark both methods at 4096 and 2048 @ 48 kHz and report the speed-up.

## Acceptance

- `npx tsc --noEmit` and `npx vitest run src/core` pass.
- ≥ 10× faster than direct at 4096 @ 48 kHz in the Node benchmark.
- Public API of `MpmDetector` unchanged (only the optional `method` option added).

## Plan

**Files**: new `src/core/fft.ts`, new `src/core/fft.test.ts`; edit `src/core/mpm.ts`, `src/core/mpm.test.ts`. `src/audio/tuner.ts` only passes `{ bufferSize, hopSize }` (Partial), so it is unaffected.

**FFT design** (`fft.ts`, Float64 throughout):
- `class RealFft { constructor(size: number /* power of 2, ≥ 4 */); forward(input: Float64Array /* len size */, outRe: Float64Array, outIm: Float64Array /* len size/2+1 */): void }`. Inside it is a complex radix-2 iterative FFT (in place, decimation in time) of size `h = size/2` on the packed sequence `z[k] = x[2k] + i·x[2k+1]`. A split step `X[k] = ½(Z[k]+Z*[h−k]) − ½i·e^{−2πik/size}(Z[k]−Z*[h−k])` then gives bins 0..h. This is about half the work of a complex FFT of size `size`.
- Tables built in the constructor: `bitrev: Uint32Array(h)`; `cos/sin: Float64Array(size/2)` for the twiddles (the half-size FFT uses every other entry, the split step uses all of them); scratch `zr/zi: Float64Array(h)`. Nothing is allocated in `forward`. I also export a small `fftComplexInPlace(re, im, tables)` so tests can check the core FFT against a naive DFT.
- **Inverse without a second routine**: the power spectrum `P[k] = |X[k]|²` is real and even (`P[M−k] = P[k]`), so `IFFT(P) = FFT(P)/M` and the result is real. The detector writes `P` out to full length M (mirrored) in a Float64Array and calls the same `forward`; `r(τ) = outRe[τ]/M` for τ ≤ tauMax (the imaginary part is ≈ 0 and ignored).
- **Size**: `M = nextPow2(N + tauMax)`. Linear correlation needs `M ≥ N + tauMax` for lags up to tauMax to avoid circular wrap. Since tauMax ≤ N/2, this equals the spec's "≥ 2N" for power-of-two N (4096 → 8192, 2048 → 4096 or less at high minFreq) and still works when bufferSize is not a power of two (e.g. 3000).
- **Memory per detector (N = 4096, M = 8192)**: input/P buffer 64 KB, spectrum re/im 2×33 KB, scratch 2×32 KB, cos/sin 2×32 KB, bitrev 16 KB, about 270 KB in total. It is allocated only when `method === 'fft'`.

**m(τ) recurrence vs the direct loop**: the direct loop computes, for τ in [tauMin, tauMax], `acf = Σ_{i=0}^{N−τ−1} x[i]·x[i+τ]` and `m = Σ_{i=0}^{N−τ−1} x[i]² + Σ_{j=τ}^{N−1} x[j]²`. Going from τ−1 to τ, the first sum loses i = N−τ and the second loses j = τ−1, so `m(0) = 2·Σx²` and `m(τ) = m(τ−1) − x[τ−1]² − x[N−τ]²`, exactly as the spec says. The recurrence has to run from τ = 1 (O(tauMax), cheap) even though nsdf is only written for [tauMin, tauMax]. Entries below tauMin stay untouched, as in direct, because nothing reads them. `m(0)` reuses the `sumSq` that `analyze()` already computes (a double over the same Float32 `lin`). For τ = N/2 with even N, the two terms are x[N/2−1]² and x[N/2]², different samples, so there is no double subtraction. For odd N, `tauMax ≤ floor(N/2)`, which is fine. I keep the guard `nsdf = m > 0 ? 2r/m : 0`.

**Precision**:
- Each sample index falls in at least one of the two sums when τ ≤ N/2, so `m(τ) ≥ Σx² = m(0)/2`. The subtraction can never cancel badly: the relative error is about τ·ε ≈ 1e-13. The RMS gate guarantees Σx² > 0, so the `m > 0` guard is unreachable in practice.
- The FFT error in r(τ) is about ε·log₂M·Σx² in absolute terms. Divided by m ≥ Σx², the nsdf error is ~1e-14. Direct also accumulates in doubles (float32×float32 products are exact in double). Both store into the Float32 `nsdf`, so they should agree to within 1 float32 ulp (~6e-8).
- The only way decisions could diverge is an nsdf value within ~1e-7 of 0 (sign at a zero crossing) or a tie in key-max/threshold comparisons. That is measure-zero; frequency differences should be ≪ 0.1 cent.

**`method` wiring**: add `method: 'fft' | 'direct'` to `MpmOptions`, with `DEFAULT_MPM_OPTIONS.method = 'fft'`. The constructor validates it (throws otherwise) and allocates either the FFT resources or nothing extra. `detectPitch` first calls `this.computeNsdfFft(x, N, sumSq)` or `this.computeNsdfDirect(x, N)`, which fill `nsdf[tauMin..tauMax]`; peak picking and interpolation stay byte-for-byte as they are. `sumSq` gets threaded from `analyze()` into `detectPitch`. The FFT path copies `lin` into the Float64 input buffer, zeroes [N, M) (re-zeroed each call because `forward` reuses the buffer for P), runs forward, builds P mirrored, runs forward again, then does the m recurrence and the nsdf loop.

**Tests**:
- `fft.test.ts`: (1) the complex FFT vs a naive O(n²) DFT on seeded random input, sizes 4/8/64/1024, max abs error < 1e-9·n; (2) RealFft vs the naive DFT of a real input, all bins 0..n/2, sizes 4..4096; (3) impulse and constant inputs; (4) round trip: autocorrelation via FFT vs naive linear ACF on random data; (5) the constructor rejects non-powers of two and sizes < 4.
- `mpm.test.ts`: all existing tests run unchanged (default = fft). A comparison block reads `det['nsdf']` after one push, using the same private-access trick as the bench. It checks fft vs direct for sines (82/440/1318 Hz), sine + harmonics, seeded noise, a partially filled ring (leading zeros) and a half-silent window, over sr 44100/48000 and bufferSize 4096/2048/3000. It asserts max |Δnsdf| over [tauMin, tauMax] < 1e-4, |Δcents| < 0.1 and clarity within 1e-4. It also runs the pure-sine ±1 cent tests with `method: 'direct'`, and a constructor test for an invalid `method`.
- **Benchmark**: extend `bench()` to run both methods at 4096 and 2048 @ 48 kHz (same chunks/warm-up/runs) and log mean/p95 plus the speed-up. No timing assertion, because it would be flaky on CI/WSL. Numbers go into `## Result`. Expected FFT cost is about 2 real FFTs of 8192 (≈ 2 complex FFTs of 4096) plus O(M) loops, roughly 0.2–0.5 ms on V8, i.e. ≥ 20× faster than 10.8 ms.

**Risks**: if V8 dislikes the closure/property access, the FFT inner loop is the hot spot. Plan: cache typed arrays in locals and keep the loop monomorphic. Hermes speed-up is unverifiable here, but the gain is algorithmic (≈ 6.5 M MACs down to ≈ 0.3 M flops), so it should carry over.

## Result

**Done (as planned, with the coordinator's answers: `method` is required in `MpmOptions` with default `'fft'`; M = nextPow2(N + tauMax); speed-up logged only):**
- **New `src/core/fft.ts`:**
  - `ComplexFft(size)` is an in-place iterative radix-2 FFT.
  - `RealFft(size ≥ 4)` runs a half-size complex FFT on the packed input, then a split step, and outputs bins 0..size/2.
  - `nextPowerOfTwo` helper.
  - Bit-reversal, twiddle and scratch tables are built in the constructors, so the transforms allocate nothing.
- **`src/core/mpm.ts`:**
  - New `MpmMethod` type and `method` option, default `'fft'`. The constructor throws on an invalid value.
  - FFT resources (about 270 KB at N = 4096) are allocated only when `method` is `'fft'`.
  - `computeNsdfFft`: r(τ) = FFT(|FFT(x padded to M)|²)/M, using the same real forward transform twice because the power spectrum is real and even.
  - m(τ) uses the recurrence `m(0) = 2·sumSq`, `m(τ) = m(τ−1) − x[τ−1]² − x[N−τ]²`. It runs from τ = 1, and nsdf is written only for [tauMin, tauMax].
  - The worklet loop is kept as `computeNsdfDirect`. Peak picking, the clarity gate and interpolation are unchanged.
  - `MpmDetector`'s public API is unchanged; `src/audio/tuner.ts` passes a Partial and is unaffected.
- **Tests:**
  - New `src/core/fft.test.ts` (15 tests):
    - complex FFT vs naive DFT at sizes 1–1024;
    - real FFT vs naive DFT at sizes 4–4096;
    - impulse and constant inputs;
    - linear ACF via FFT vs naive ACF;
    - constructor rejections.
  - `src/core/mpm.test.ts`:
    - All 01 tests run unchanged on the default fft path.
    - 48 fft-vs-direct cases: sines at 82/440/1318 Hz, harmonics, noise, a partly filled ring and a half-silent window, over 44.1/48 kHz and N = 4096/2048/3000. Each asserts max |Δnsdf| < 1e-4, identical rms, |Δclarity| < 1e-4, the same voiced/unvoiced decision and |Δf| < 0.1 cent.
    - Direct-method ±1 cent sine tests and an invalid-method test.

**Verification (from `native/`):**
- `npx vitest run src/core` → 3 files, 99/99 tests pass.
- `npx tsc --noEmit` → exit 0, with no errors in any file, including other tasks' files.

**Benchmark** (node v22.20 / V8, WSL, 440 Hz sine at 48 kHz, one analysis per push, 200 runs after 20 warm-up; run with `npx vitest run src/core --silent=false -t benchmark`):

| bufferSize @ 48 kHz | direct mean / p95 | fft mean / p95 | speed-up |
|---|---|---|---|
| 4096 (M = 8192) | 7.50 / 9.67 ms | 0.332 / 0.418 ms | **22.6×** |
| 2048 (M = 4096) | 2.24 / 2.72 ms | 0.206 / 0.297 ms | 10.9× |

This meets the ≥ 10× acceptance at 4096. Direct was faster in this run than in 01's 10.8 ms, which is normal machine noise. The gain is algorithmic (about 6.5 M MACs down to about 0.3 M flops), so it should carry over to Hermes; device timing is still to be confirmed by 02-tuner's on-device logging.

**Not verifiable here:** absolute time per analysis under Hermes on a real device.
