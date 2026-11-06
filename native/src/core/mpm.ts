// SHARED WITH THE WEB PWA: bundled into src/audio/worklets/mpm-processor.ts
// (AudioWorklet scope). Keep it dependency-free: no react-native, Expo, DOM
// or Node imports — only other files in this folder. Check: npm run check:worklet
// at the repo root.

// McLeod Pitch Method (NSDF + key-maximum picking + parabolic interpolation).
// Pure TS port of the web worklet `src/audio/worklets/mpm-processor.js`.
// Behaviour is kept line-for-line identical (thresholds, peak picking,
// interpolation, Float32 storage). Typed arrays are preallocated; the only
// per-analysis allocation is the returned result object (at most one per push).
//
// The NSDF is computed either directly (O(N·tauMax), the worklet's loop) or,
// by default, via FFT autocorrelation (O(M log M), M = nextPow2(N + tauMax) so
// lags up to tauMax don't wrap) plus the incremental m(τ) recurrence. Both fill
// the same Float32 nsdf; everything after (peak picking, interpolation) is shared.
//
// Departures from the worklet (06-tuner-detection):
// - Input is band-limited by a 4th-order Butterworth low-pass (`lowpassHz`,
//   default 5 kHz) before the ring buffer. Broadband mic noise above the
//   musical range otherwise lowers NSDF clarity below the gate (low E2 lost).
// - The lag-0 positive lobe is skipped starting at τ=1, not at tauMin, and only
//   key maxima with τ ≥ tauMin are kept. Starting at tauMin swallowed the first
//   real peak when the period was close to tauMin (C8 read an octave low).
// - Default rmsThreshold lowered 0.01 → 0.003: the raw native mic has no AGC,
//   so a decaying note fell under 0.01 early. Noise alone never passes the
//   0.85 clarity gate, so the lower gate adds no noise false positives.

import { ButterworthLowpass } from './biquad'
import { RealFft, nextPowerOfTwo } from './fft'

export type MpmMethod = 'fft' | 'direct'

export type PitchSample = { frequency: number; clarity: number; rms: number }

export type MpmRejectReason = 'ok' | 'gate' | 'clarity' | 'nopeak'

/** Per-analysis diagnostics, filled even when the frame is rejected. */
export type MpmDebug = {
  /** Hz of the chosen key maximum even when rejected (0 for gate/nopeak). */
  rawFrequency: number
  clarity: number
  /** RMS of the filtered window (what the gate sees). */
  rms: number
  /** RMS of the same window before the low-pass (= rms when the filter is off). */
  rmsUnfiltered: number
  reason: MpmRejectReason
}

export type MpmOptions = {
  bufferSize: number
  hopSize: number
  minFreq: number
  maxFreq: number
  clarityThreshold: number
  rmsThreshold: number
  keyMaxRatio: number
  /** NSDF computation: 'fft' (default, fast) or 'direct' (reference loop). */
  method: MpmMethod
  /** Low-pass cutoff applied to the input (Hz). 0 = off; also off when ≥ 0.45·sampleRate. */
  lowpassHz: number
}

export const DEFAULT_MPM_OPTIONS: MpmOptions = {
  bufferSize: 4096,
  hopSize: 512,
  minFreq: 30,
  maxFreq: 5000,
  clarityThreshold: 0.85,
  rmsThreshold: 0.003,
  keyMaxRatio: 0.93,
  method: 'fft',
  lowpassHz: 5000,
}

/** Effective cutoff for a given rate (0 = filter disabled). */
export function effectiveLowpassHz(sampleRate: number, lowpassHz: number): number {
  return lowpassHz > 0 && lowpassHz < 0.45 * sampleRate ? lowpassHz : 0
}

type FftState = {
  M: number
  fft: RealFft
  buf: Float64Array // zero-padded window, then reused for the power spectrum
  re: Float64Array
  im: Float64Array
}

export class MpmDetector {
  private readonly sampleRate: number
  private readonly opts: MpmOptions
  private readonly ring: Float32Array
  private readonly linear: Float32Array
  private readonly nsdf: Float32Array
  private readonly peaks: Int32Array
  private readonly tauMin: number
  private readonly tauMax: number
  private readonly fftState: FftState | null
  private readonly lowpass: ButterworthLowpass | null
  /** Unfiltered copy of the window (only when the filter is on), for rmsUnfiltered. */
  private readonly rawRing: Float32Array | null
  private scratch: Float32Array = new Float32Array(0)
  private readonly debug: MpmDebug = {
    rawFrequency: 0,
    clarity: 0,
    rms: 0,
    rmsUnfiltered: 0,
    reason: 'gate',
  }
  private writeIdx = 0
  private samplesSinceAnalysis = 0

  constructor(sampleRate: number, opts?: Partial<MpmOptions>) {
    if (!(sampleRate > 0)) throw new Error(`MpmDetector: invalid sampleRate ${sampleRate}`)
    const o: MpmOptions = { ...DEFAULT_MPM_OPTIONS, ...opts }
    if (!(o.bufferSize >= 2) || !Number.isInteger(o.bufferSize)) {
      throw new Error(`MpmDetector: invalid bufferSize ${o.bufferSize}`)
    }
    if (!(o.hopSize >= 1)) throw new Error(`MpmDetector: invalid hopSize ${o.hopSize}`)
    if (o.method !== 'fft' && o.method !== 'direct') {
      throw new Error(`MpmDetector: invalid method ${String(o.method)}`)
    }
    this.sampleRate = sampleRate
    this.opts = o
    const N = o.bufferSize
    this.ring = new Float32Array(N)
    this.linear = new Float32Array(N)
    this.tauMin = Math.max(2, Math.floor(sampleRate / o.maxFreq))
    this.tauMax = Math.min(N >> 1, Math.ceil(sampleRate / o.minFreq))
    this.nsdf = new Float32Array(this.tauMax + 1)
    this.peaks = new Int32Array(this.tauMax + 1)
    const fc = effectiveLowpassHz(sampleRate, o.lowpassHz)
    this.lowpass = fc > 0 ? new ButterworthLowpass(sampleRate, fc, 4) : null
    this.rawRing = this.lowpass ? new Float32Array(N) : null
    if (o.method === 'fft') {
      const M = Math.max(4, nextPowerOfTwo(N + this.tauMax))
      this.fftState = {
        M,
        fft: new RealFft(M),
        buf: new Float64Array(M),
        re: new Float64Array((M >> 1) + 1),
        im: new Float64Array((M >> 1) + 1),
      }
    } else {
      this.fftState = null
    }
  }

  /**
   * Append an arbitrary-length chunk. When at least `hopSize` new samples have
   * arrived since the last analysis, the counter resets to 0 (same rule as the
   * worklet) and ONE analysis of the newest `bufferSize` samples is returned.
   * Large chunks therefore yield a single, up-to-date result rather than
   * several stale ones. Otherwise returns null.
   */
  push(input: Float32Array): PitchSample | null {
    const len = input.length
    if (len === 0) return null
    const N = this.opts.bufferSize
    let samples = input
    if (this.lowpass && this.rawRing) {
      if (this.scratch.length < len) this.scratch = new Float32Array(len)
      samples = this.scratch.subarray(0, len)
      this.lowpass.process(input, samples)
      writeRing(this.rawRing, this.writeIdx, input)
    }
    const ring = this.ring

    if (len >= N) {
      ring.set(samples.subarray(len - N))
      this.writeIdx = 0
    } else {
      const w = this.writeIdx
      const first = Math.min(len, N - w)
      ring.set(first === len ? samples : samples.subarray(0, first), w)
      if (first < len) ring.set(samples.subarray(first), 0)
      this.writeIdx = (w + len) % N
    }

    this.samplesSinceAnalysis += len
    if (this.samplesSinceAnalysis >= this.opts.hopSize) {
      this.samplesSinceAnalysis = 0
      return this.analyze()
    }
    return null
  }

  /** Diagnostics of the latest analysis (same object, mutated in place). */
  get lastDebug(): Readonly<MpmDebug> {
    return this.debug
  }

  /** Low-pass cutoff in use (0 = off). */
  get lowpassHz(): number {
    return this.lowpass ? effectiveLowpassHz(this.sampleRate, this.opts.lowpassHz) : 0
  }

  reset(): void {
    this.ring.fill(0)
    this.rawRing?.fill(0)
    this.lowpass?.reset()
    this.writeIdx = 0
    this.samplesSinceAnalysis = 0
  }

  private analyze(): PitchSample {
    const N = this.opts.bufferSize
    const lin = this.linear
    const w = this.writeIdx
    // Oldest sample is at writeIdx: linearise in two block copies.
    lin.set(this.ring.subarray(w), 0)
    if (w > 0) lin.set(this.ring.subarray(0, w), N - w)

    let sumSq = 0
    for (let i = 0; i < N; i++) {
      const s = lin[i]
      sumSq += s * s
    }
    const rms = Math.sqrt(sumSq / N)

    const dbg = this.debug
    dbg.rms = rms
    dbg.rmsUnfiltered = this.rawRing ? rmsOf(this.rawRing) : rms
    dbg.rawFrequency = 0
    dbg.clarity = 0

    if (rms < this.opts.rmsThreshold) {
      dbg.reason = 'gate'
      return { frequency: 0, clarity: 0, rms }
    }
    return this.detectPitch(lin, N, sumSq, rms)
  }

  /** Reference NSDF: the worklet's O(N·tauMax) loop. */
  private computeNsdfDirect(x: Float32Array, N: number): void {
    const tauMax = this.tauMax
    const nsdf = this.nsdf
    // From τ=1 (not tauMin) so the lag-0 lobe can be skipped correctly.
    for (let tau = 1; tau <= tauMax; tau++) {
      let acf = 0
      let m = 0
      const limit = N - tau
      for (let i = 0; i < limit; i++) {
        const a = x[i]
        const b = x[i + tau]
        acf += a * b
        m += a * a + b * b
      }
      nsdf[tau] = m > 0 ? (2 * acf) / m : 0
    }
  }

  /**
   * FFT NSDF. r(τ) = IFFT(|FFT(x zero-padded to M)|²)[τ]; since the power
   * spectrum is real and even, IFFT(P) = FFT(P)/M, so the same real forward
   * transform is used twice. m(τ) = Σ_{i<N-τ} x[i]² + Σ_{j≥τ} x[j]² follows
   * m(0) = 2·Σx², m(τ) = m(τ-1) − x[τ-1]² − x[N-τ]². For τ ≤ N/2 every sample
   * is in at least one sum, so m(τ) ≥ m(0)/2: no catastrophic cancellation.
   */
  private computeNsdfFft(x: Float32Array, N: number, sumSq: number, st: FftState): void {
    const { M, fft, buf, re, im } = st
    const tauMax = this.tauMax
    const nsdf = this.nsdf

    for (let i = 0; i < N; i++) buf[i] = x[i]
    buf.fill(0, N)
    fft.forward(buf, re, im)

    const half = M >> 1
    buf[0] = re[0] * re[0] + im[0] * im[0]
    buf[half] = re[half] * re[half] + im[half] * im[half]
    for (let k = 1; k < half; k++) {
      const p = re[k] * re[k] + im[k] * im[k]
      buf[k] = p
      buf[M - k] = p
    }
    fft.forward(buf, re, im)

    const invM = 1 / M
    let m = 2 * sumSq
    for (let tau = 1; tau <= tauMax; tau++) {
      const a = x[tau - 1]
      const b = x[N - tau]
      m -= a * a + b * b
      nsdf[tau] = m > 0 ? (2 * re[tau] * invM) / m : 0
    }
  }

  private detectPitch(x: Float32Array, N: number, sumSq: number, rms: number): PitchSample {
    const tauMin = this.tauMin
    const tauMax = this.tauMax
    const nsdf = this.nsdf
    const peaks = this.peaks

    if (this.fftState) this.computeNsdfFft(x, N, sumSq, this.fftState)
    else this.computeNsdfDirect(x, N)

    // Key maxima: peaks lying within positive regions between zero crossings.
    let peakCount = 0
    let pos = 1

    // Skip the initial positive region near tau=0 (from τ=1, see header).
    while (pos <= tauMax && nsdf[pos] > 0) pos++

    while (pos <= tauMax) {
      while (pos <= tauMax && nsdf[pos] <= 0) pos++
      if (pos > tauMax) break

      let maxPos = pos
      let maxVal = nsdf[pos]
      while (pos <= tauMax && nsdf[pos] > 0) {
        if (nsdf[pos] > maxVal) {
          maxVal = nsdf[pos]
          maxPos = pos
        }
        pos++
      }
      if (maxPos >= tauMin) peaks[peakCount++] = maxPos
    }

    const dbg = this.debug
    if (peakCount === 0) {
      dbg.reason = 'nopeak'
      return { frequency: 0, clarity: 0, rms }
    }

    let highest = 0
    for (let i = 0; i < peakCount; i++) {
      const v = nsdf[peaks[i]]
      if (v > highest) highest = v
    }

    const threshold = this.opts.keyMaxRatio * highest
    let chosen = peaks[0]
    for (let i = 0; i < peakCount; i++) {
      if (nsdf[peaks[i]] >= threshold) {
        chosen = peaks[i]
        break
      }
    }

    const clarity = nsdf[chosen]

    // Parabolic interpolation for sub-sample precision (nsdf is valid from τ=1).
    const alpha = chosen > 1 ? nsdf[chosen - 1] : clarity
    const beta = clarity
    const gamma = chosen < tauMax ? nsdf[chosen + 1] : clarity
    const denom = alpha - 2 * beta + gamma
    const shift = denom !== 0 ? (0.5 * (alpha - gamma)) / denom : 0
    const frequency = this.sampleRate / (chosen + shift)

    dbg.clarity = clarity
    dbg.rawFrequency = frequency
    if (clarity < this.opts.clarityThreshold) {
      dbg.reason = 'clarity'
      return { frequency: 0, clarity, rms }
    }
    dbg.reason = 'ok'
    return { frequency, clarity, rms }
  }
}

function writeRing(ring: Float32Array, w: number, samples: Float32Array): void {
  const N = ring.length
  const len = samples.length
  if (len >= N) {
    // Keep the same layout as the main ring: newest N samples, writeIdx reset to 0.
    ring.set(samples.subarray(len - N))
    return
  }
  const first = Math.min(len, N - w)
  ring.set(first === len ? samples : samples.subarray(0, first), w)
  if (first < len) ring.set(samples.subarray(first), 0)
}

function rmsOf(x: Float32Array): number {
  let s = 0
  for (let i = 0; i < x.length; i++) s += x[i] * x[i]
  return Math.sqrt(s / x.length)
}
