// Deterministic synthetic signals for detector tests (no runtime use).

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rnd: () => number): number {
  const u = rnd() || 1e-12
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd())
}

export type PluckOptions = {
  f0: number
  sampleRate: number
  seconds: number
  /** Fundamental amplitude relative to partials 2–8 (= 1). */
  h1: number
  /** Inharmonicity: f_k = k·f0·sqrt(1 + B·k²). */
  B: number
  /** Rolloff exponent above partial 8: a_k = (8/k)^tilt. */
  tilt: number
  /** Peak level of the plucked tone before noise. */
  peak: number
  /** Std-dev of white Gaussian noise added (full band). */
  noise: number
  /** 2nd-order Butterworth high-pass (mic rolloff), 0 = none. */
  highpassHz: number
  seed: number
}

export const E2_PLUCK: PluckOptions = {
  f0: 82.41,
  sampleRate: 48000,
  seconds: 2.2,
  h1: 0.3,
  B: 1e-4,
  tilt: 1.5,
  peak: 0.3,
  noise: 0.008,
  highpassHz: 120,
  seed: 1,
}

/**
 * Plucked-string model: weak fundamental, strong partials 2–8, per-partial
 * exponential decay (0.5 + 0.15·k per second), slight inharmonicity, random
 * phases, a mic high-pass and white noise.
 */
export function pluck(opts: Partial<PluckOptions> = {}): Float32Array {
  const p: PluckOptions = { ...E2_PLUCK, ...opts }
  const sr = p.sampleRate
  const n = Math.floor(sr * p.seconds)
  const x = new Float32Array(n)
  const rnd = mulberry32(p.seed)
  const partials: { w: number; a: number; ph: number; d: number }[] = []
  for (let k = 1; k <= 60; k++) {
    const f = k * p.f0 * Math.sqrt(1 + p.B * k * k)
    if (f > 0.45 * sr) break
    const a = k === 1 ? p.h1 : k <= 8 ? 1 : Math.pow(8 / k, p.tilt)
    partials.push({ w: (2 * Math.PI * f) / sr, a, ph: rnd() * 2 * Math.PI, d: (0.5 + 0.15 * k) / sr })
  }
  const tmp = new Float64Array(n)
  let pk = 0
  for (let i = 0; i < n; i++) {
    let s = 0
    for (const q of partials) s += q.a * Math.exp(-q.d * i) * Math.sin(q.w * i + q.ph)
    tmp[i] = s
    pk = Math.max(pk, Math.abs(s))
  }
  const g = pk > 0 ? p.peak / pk : 0
  for (let i = 0; i < n; i++) tmp[i] = tmp[i] * g + p.noise * gaussian(rnd)
  if (p.highpassHz > 0) {
    const w = Math.tan((Math.PI * p.highpassHz) / sr)
    const q = Math.SQRT1_2
    const norm = 1 / (1 + w / q + w * w)
    const b0 = norm, b1 = -2 * norm, b2 = norm
    const a1 = 2 * (w * w - 1) * norm, a2 = (1 - w / q + w * w) * norm
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let i = 0; i < n; i++) {
      const v = tmp[i]
      const y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1; x1 = v; y2 = y1; y1 = y
      tmp[i] = y
    }
  }
  for (let i = 0; i < n; i++) x[i] = tmp[i]
  return x
}

/** White Gaussian (or 'pink', Paul Kellet's filter) noise. */
export function noiseSignal(n: number, std: number, color: 'white' | 'pink', seed = 7): Float32Array {
  const rnd = mulberry32(seed)
  const x = new Float32Array(n)
  let b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < n; i++) {
    const u = gaussian(rnd)
    if (color === 'white') {
      x[i] = std * u
    } else {
      b0 = 0.99765 * b0 + u * 0.099046
      b1 = 0.963 * b1 + u * 0.2965164
      b2 = 0.57 * b2 + u * 1.0526913
      x[i] = (b0 + b1 + b2 + u * 0.1848) * std * 0.25
    }
  }
  return x
}

/** Sum of the first `harmonics` partials (1/k amplitudes), peak-ish `amp`. */
export function harmonicTone(f: number, sr: number, n: number, harmonics = 4, amp = 0.3): Float32Array {
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let k = 1; k <= harmonics; k++) {
      if (k * f < sr / 2) s += Math.sin((2 * Math.PI * k * f * i) / sr + k) / k
    }
    x[i] = amp * s
  }
  return x
}

/**
 * Windowed-sinc (Blackman) low-pass + decimation by D: a stand-in for the
 * recorder's r8brain resampler (48k→24k ≈ brick-wall at ~11.7 kHz).
 */
export function lowpassDecimate(x: Float32Array, sr: number, cutoffHz: number, D: number, taps = 255): Float32Array {
  const h = new Float64Array(taps)
  const M = taps - 1
  let sum = 0
  for (let i = 0; i < taps; i++) {
    const m = i - M / 2
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / M) + 0.08 * Math.cos((4 * Math.PI * i) / M)
    const s = m === 0 ? (2 * cutoffHz) / sr : Math.sin((2 * Math.PI * cutoffHz * m) / sr) / (Math.PI * m)
    h[i] = s * w
    sum += h[i]
  }
  for (let i = 0; i < taps; i++) h[i] /= sum
  const out = new Float32Array(Math.floor(x.length / D))
  for (let o = 0; o < out.length; o++) {
    const c = o * D
    let a = 0
    for (let k = 0; k < taps && c - k >= 0; k++) a += h[k] * x[c - k]
    out[o] = a
  }
  return out
}
