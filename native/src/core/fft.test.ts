import { describe, expect, it } from 'vitest'
import { ComplexFft, RealFft, nextPowerOfTwo } from './fft'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomArray(n: number, seed: number): Float64Array {
  const rnd = mulberry32(seed)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = rnd() * 2 - 1
  return out
}

function naiveDft(re: Float64Array, im: Float64Array): { re: Float64Array; im: Float64Array } {
  const n = re.length
  const oRe = new Float64Array(n)
  const oIm = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    let sr = 0
    let si = 0
    for (let t = 0; t < n; t++) {
      const a = (-2 * Math.PI * ((k * t) % n)) / n
      const c = Math.cos(a)
      const s = Math.sin(a)
      sr += re[t] * c - im[t] * s
      si += re[t] * s + im[t] * c
    }
    oRe[k] = sr
    oIm[k] = si
  }
  return { re: oRe, im: oIm }
}

describe('ComplexFft', () => {
  for (const n of [1, 2, 4, 8, 64, 1024]) {
    it(`matches naive DFT, size ${n}`, () => {
      const re = randomArray(n, n)
      const im = randomArray(n, n + 1)
      const ref = naiveDft(re, im)
      new ComplexFft(n).transform(re, im)
      for (let k = 0; k < n; k++) {
        expect(Math.abs(re[k] - ref.re[k])).toBeLessThan(1e-9 * n)
        expect(Math.abs(im[k] - ref.im[k])).toBeLessThan(1e-9 * n)
      }
    })
  }

  it('rejects non powers of two', () => {
    expect(() => new ComplexFft(0)).toThrow()
    expect(() => new ComplexFft(12)).toThrow()
  })
})

describe('RealFft', () => {
  for (const n of [4, 8, 16, 256, 4096]) {
    it(`matches naive DFT of real input, size ${n}`, () => {
      const x = randomArray(n, 7 * n)
      const ref = naiveDft(x, new Float64Array(n))
      const re = new Float64Array(n / 2 + 1)
      const im = new Float64Array(n / 2 + 1)
      new RealFft(n).forward(x, re, im)
      for (let k = 0; k <= n / 2; k++) {
        expect(Math.abs(re[k] - ref.re[k])).toBeLessThan(1e-9 * n)
        expect(Math.abs(im[k] - ref.im[k])).toBeLessThan(1e-9 * n)
      }
    })
  }

  it('impulse → flat spectrum; constant → DC only', () => {
    const n = 32
    const fft = new RealFft(n)
    const re = new Float64Array(n / 2 + 1)
    const im = new Float64Array(n / 2 + 1)
    const impulse = new Float64Array(n)
    impulse[0] = 1
    fft.forward(impulse, re, im)
    for (let k = 0; k <= n / 2; k++) {
      expect(re[k]).toBeCloseTo(1, 12)
      expect(im[k]).toBeCloseTo(0, 12)
    }
    fft.forward(new Float64Array(n).fill(2), re, im)
    expect(re[0]).toBeCloseTo(2 * n, 10)
    for (let k = 1; k <= n / 2; k++) {
      expect(Math.abs(re[k])).toBeLessThan(1e-10)
      expect(Math.abs(im[k])).toBeLessThan(1e-10)
    }
  })

  it('linear autocorrelation via FFT(|FFT|²)/M matches naive ACF', () => {
    const N = 300
    const maxLag = 150
    const M = nextPowerOfTwo(N + maxLag)
    const x = randomArray(N, 99)
    const fft = new RealFft(M)
    const buf = new Float64Array(M)
    buf.set(x)
    const re = new Float64Array(M / 2 + 1)
    const im = new Float64Array(M / 2 + 1)
    fft.forward(buf, re, im)
    for (let k = 0; k <= M / 2; k++) {
      const p = re[k] * re[k] + im[k] * im[k]
      buf[k] = p
      if (k > 0 && k < M / 2) buf[M - k] = p
    }
    fft.forward(buf, re, im)
    for (let tau = 0; tau <= maxLag; tau++) {
      let acf = 0
      for (let i = 0; i < N - tau; i++) acf += x[i] * x[i + tau]
      expect(Math.abs(re[tau] / M - acf)).toBeLessThan(1e-9)
      expect(Math.abs(im[tau] / M)).toBeLessThan(1e-9)
    }
  })

  it('rejects sizes that are not powers of two or < 4', () => {
    expect(() => new RealFft(2)).toThrow()
    expect(() => new RealFft(100)).toThrow()
  })
})
