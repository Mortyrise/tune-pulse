// Minimal radix-2 FFT (no dependencies), Float64 throughout.
// All tables and scratch buffers are preallocated in the constructors; the
// transform methods allocate nothing.

function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && (n & (n - 1)) === 0
}

export function nextPowerOfTwo(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/** In-place iterative complex FFT (decimation in time), forward direction e^{-2πikn/N}. */
export class ComplexFft {
  readonly size: number
  private readonly bitrev: Uint32Array
  private readonly cosT: Float64Array
  private readonly sinT: Float64Array

  constructor(size: number) {
    if (!isPowerOfTwo(size)) throw new Error(`ComplexFft: size must be a power of two, got ${size}`)
    this.size = size
    let bits = 0
    while (1 << bits < size) bits++
    this.bitrev = new Uint32Array(size)
    for (let i = 0; i < size; i++) {
      let r = 0
      for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b)
      this.bitrev[i] = r
    }
    const half = size >> 1
    this.cosT = new Float64Array(half)
    this.sinT = new Float64Array(half)
    for (let k = 0; k < half; k++) {
      this.cosT[k] = Math.cos((2 * Math.PI * k) / size)
      this.sinT[k] = Math.sin((2 * Math.PI * k) / size)
    }
  }

  transform(re: Float64Array, im: Float64Array): void {
    const n = this.size
    const bitrev = this.bitrev
    const cosT = this.cosT
    const sinT = this.sinT

    for (let i = 0; i < n; i++) {
      const j = bitrev[i]
      if (j > i) {
        let t = re[i]
        re[i] = re[j]
        re[j] = t
        t = im[i]
        im[i] = im[j]
        im[j] = t
      }
    }

    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1
      const step = n / len // index stride into the size-n twiddle table
      for (let start = 0; start < n; start += len) {
        for (let j = 0, t = 0; j < halfLen; j++, t += step) {
          const wr = cosT[t]
          const wi = -sinT[t]
          const a = start + j
          const b = a + halfLen
          const xr = re[b] * wr - im[b] * wi
          const xi = re[b] * wi + im[b] * wr
          re[b] = re[a] - xr
          im[b] = im[a] - xi
          re[a] += xr
          im[a] += xi
        }
      }
    }
  }
}

/**
 * Forward FFT of a real sequence of length `size` (power of two, ≥ 4), computed
 * with one complex FFT of size/2 on the packed sequence z[k] = x[2k] + i·x[2k+1]
 * plus a split step. Outputs bins 0..size/2 (the rest follow by conjugate symmetry).
 */
export class RealFft {
  readonly size: number
  private readonly half: number
  private readonly cfft: ComplexFft
  private readonly zr: Float64Array
  private readonly zi: Float64Array
  private readonly cosT: Float64Array
  private readonly sinT: Float64Array

  constructor(size: number) {
    if (!isPowerOfTwo(size) || size < 4) {
      throw new Error(`RealFft: size must be a power of two ≥ 4, got ${size}`)
    }
    this.size = size
    const h = size >> 1
    this.half = h
    this.cfft = new ComplexFft(h)
    this.zr = new Float64Array(h)
    this.zi = new Float64Array(h)
    this.cosT = new Float64Array(h)
    this.sinT = new Float64Array(h)
    for (let k = 0; k < h; k++) {
      this.cosT[k] = Math.cos((2 * Math.PI * k) / size)
      this.sinT[k] = Math.sin((2 * Math.PI * k) / size)
    }
  }

  /** `input` length ≥ size (first `size` used); `outRe`/`outIm` length ≥ size/2 + 1. */
  forward(input: Float64Array, outRe: Float64Array, outIm: Float64Array): void {
    const h = this.half
    const zr = this.zr
    const zi = this.zi
    for (let k = 0; k < h; k++) {
      zr[k] = input[2 * k]
      zi[k] = input[2 * k + 1]
    }
    this.cfft.transform(zr, zi)

    const cosT = this.cosT
    const sinT = this.sinT
    outRe[0] = zr[0] + zi[0]
    outIm[0] = 0
    outRe[h] = zr[0] - zi[0]
    outIm[h] = 0
    for (let k = 1; k < h; k++) {
      const a = zr[k]
      const b = zi[k]
      const c = zr[h - k]
      const d = zi[h - k]
      // Even part Xe = (Z[k] + conj Z[h-k]) / 2, odd part Xo = (Z[k] - conj Z[h-k]) / 2i
      const er = 0.5 * (a + c)
      const ei = 0.5 * (b - d)
      const or = 0.5 * (b + d)
      const oi = -0.5 * (a - c)
      // X[k] = Xe + W^k · Xo, W = e^{-2πi/size}
      const wr = cosT[k]
      const ws = sinT[k]
      outRe[k] = er + or * wr + oi * ws
      outIm[k] = ei + oi * wr - or * ws
    }
  }
}
