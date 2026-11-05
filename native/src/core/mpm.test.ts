import { describe, expect, it } from 'vitest'
import { DEFAULT_MPM_OPTIONS, MpmDetector, type MpmOptions, type PitchSample } from './mpm'

const N = DEFAULT_MPM_OPTIONS.bufferSize

function sine(
  freq: number,
  sr: number,
  length: number,
  amp = 0.5,
  harmonics: number[] = [],
): Float32Array {
  const out = new Float32Array(length)
  const w = (2 * Math.PI * freq) / sr
  for (let i = 0; i < length; i++) {
    let v = amp * Math.sin(w * i)
    for (let h = 0; h < harmonics.length; h++) {
      v += amp * harmonics[h] * Math.sin(w * (h + 2) * i)
    }
    out[i] = v
  }
  return out
}

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

function noise(length: number, amp: number, seed = 1234): Float32Array {
  const rnd = mulberry32(seed)
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) out[i] = amp * (rnd() * 2 - 1)
  return out
}

/** Feed `signal` in `chunk`-sized pieces; return every non-null result. */
function feed(det: MpmDetector, signal: Float32Array, chunk: number): PitchSample[] {
  const results: PitchSample[] = []
  for (let off = 0; off < signal.length; off += chunk) {
    const r = det.push(signal.subarray(off, Math.min(off + chunk, signal.length)))
    if (r) results.push(r)
  }
  return results
}

function last(det: MpmDetector, signal: Float32Array, chunk: number): PitchSample {
  const rs = feed(det, signal, chunk)
  expect(rs.length).toBeGreaterThan(0)
  return rs[rs.length - 1]
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b)

describe('MpmDetector — pure sines', () => {
  for (const sr of [44100, 48000]) {
    for (const f of [82.41, 440, 1318.51]) {
      it(`${f} Hz @ ${sr} Hz within ±1 cent`, () => {
        const r = last(new MpmDetector(sr), sine(f, sr, 3 * N), 512)
        expect(r.clarity).toBeGreaterThan(DEFAULT_MPM_OPTIONS.clarityThreshold)
        expect(Math.abs(cents(r.frequency, f))).toBeLessThanOrEqual(1)
      })
    }
  }
})

describe('MpmDetector — gating', () => {
  it('silence → frequency 0, clarity 0, rms 0', () => {
    const r = last(new MpmDetector(48000), new Float32Array(2 * N), 512)
    expect(r).toEqual({ frequency: 0, clarity: 0, rms: 0 })
  })

  it('sine below rmsThreshold → frequency 0', () => {
    const r = last(new MpmDetector(48000), sine(440, 48000, 2 * N, 0.002), 512)
    expect(r.frequency).toBe(0)
    expect(r.rms).toBeLessThan(DEFAULT_MPM_OPTIONS.rmsThreshold)
  })

  it('white noise → frequency 0 or low clarity', () => {
    for (const seed of [1, 42, 1234]) {
      const r = last(new MpmDetector(48000), noise(3 * N, 0.3, seed), 512)
      expect(r.rms).toBeGreaterThan(DEFAULT_MPM_OPTIONS.rmsThreshold)
      expect(r.frequency === 0 || r.clarity < DEFAULT_MPM_OPTIONS.clarityThreshold).toBe(true)
    }
  })
})

describe('MpmDetector — harmonics', () => {
  for (const sr of [44100, 48000]) {
    for (const f of [82.41, 110, 440]) {
      it(`${f} Hz + harmonics @ ${sr} Hz → fundamental within ±1 cent`, () => {
        const r = last(new MpmDetector(sr), sine(f, sr, 3 * N, 0.4, [0.5, 0.3, 0.2]), 512)
        expect(Math.abs(cents(r.frequency, f))).toBeLessThanOrEqual(1)
      })
    }
  }
})

describe('MpmDetector — chunking', () => {
  it('chunk sizes 128 / 4096 / 8192 give identical final results', () => {
    const sig = sine(196, 48000, 4 * N, 0.4, [0.3])
    const a = last(new MpmDetector(48000), sig, 128)
    const b = last(new MpmDetector(48000), sig, 4096)
    const c = last(new MpmDetector(48000), sig, 8192)
    expect(b).toEqual(a)
    expect(c).toEqual(a)
  })

  it('odd chunk sizes wrapping the ring match a single big push', () => {
    const sig = sine(330, 44100, 3 * N + 777)
    const det = new MpmDetector(44100, { hopSize: 1 })
    const viaChunks = last(det, sig, 333)
    const single = new MpmDetector(44100).push(sig)!
    expect(viaChunks).toEqual(single)
  })

  it('cadence: 128-frame chunks → result on every 4th push', () => {
    const det = new MpmDetector(48000)
    const chunk = sine(440, 48000, 128)
    const pattern: boolean[] = []
    for (let i = 0; i < 16; i++) pattern.push(det.push(chunk) !== null)
    expect(pattern).toEqual(Array.from({ length: 16 }, (_, i) => i % 4 === 3))
  })

  it('cadence: 300-frame chunks → result on the push crossing 512, counter resets to 0', () => {
    const det = new MpmDetector(48000)
    const chunk = sine(440, 48000, 300)
    const pattern: boolean[] = []
    for (let i = 0; i < 6; i++) pattern.push(det.push(chunk) !== null)
    // 300, 600(→0), 300, 600(→0), ...
    expect(pattern).toEqual([false, true, false, true, false, true])
  })

  it('one 8192-frame chunk → exactly one result; empty chunk → null', () => {
    const det = new MpmDetector(48000)
    expect(det.push(new Float32Array(0))).toBeNull()
    expect(feed(det, sine(440, 48000, 8192), 8192)).toHaveLength(1)
  })
})

describe('MpmDetector — reset & options', () => {
  it('reset() behaves like a fresh instance', () => {
    const det = new MpmDetector(48000)
    feed(det, sine(1000, 48000, 2 * N + 100), 256)
    det.reset()
    const sig = sine(150, 48000, 2 * N)
    expect(feed(det, sig, 256)).toEqual(feed(new MpmDetector(48000), sig, 256))
  })

  it('rejects invalid constructor args', () => {
    expect(() => new MpmDetector(0)).toThrow()
    expect(() => new MpmDetector(48000, { bufferSize: 1 })).toThrow()
    expect(() => new MpmDetector(48000, { hopSize: 0 })).toThrow()
  })

  it('handles range extremes without throwing and returns finite values', () => {
    for (const f of [20, 30, 5000, 8000]) {
      const r = last(new MpmDetector(48000), sine(f, 48000, 3 * N), 512)
      expect(Number.isFinite(r.frequency)).toBe(true)
      expect(Number.isFinite(r.clarity)).toBe(true)
    }
  })

  it('bufferSize 2048 still tracks A4 within ±1 cent', () => {
    const r = last(new MpmDetector(48000, { bufferSize: 2048 }), sine(440, 48000, 3 * N), 512)
    expect(Math.abs(cents(r.frequency, 440))).toBeLessThanOrEqual(1)
  })
})

describe('MpmDetector — fft vs direct', () => {
  type Case = { name: string; sr: number; bufferSize: number; signal: (n: number) => Float32Array }
  const cases: Case[] = []
  for (const sr of [44100, 48000]) {
    for (const bufferSize of [4096, 2048, 3000]) {
      const n = 2 * bufferSize
      cases.push(
        ...[82.41, 440, 1318.51].map((f) => ({
          name: `sine ${f}`,
          sr,
          bufferSize,
          signal: () => sine(f, sr, n),
        })),
        { name: 'harmonics 110', sr, bufferSize, signal: () => sine(110, sr, n, 0.4, [0.5, 0.3, 0.2]) },
        { name: 'noise', sr, bufferSize, signal: () => noise(n, 0.3, 7) },
        {
          // ring not yet full: leading zeros in the window
          name: 'partial fill',
          sr,
          bufferSize,
          signal: () => sine(220, sr, Math.floor(bufferSize / 3)),
        },
        {
          // first half silent, second half loud
          name: 'half silent',
          sr,
          bufferSize,
          signal: () => {
            const s = sine(330, sr, bufferSize)
            s.fill(0, 0, bufferSize >> 1)
            return s
          },
        },
      )
    }
  }

  for (const c of cases) {
    it(`${c.name} @ ${c.sr} Hz, N=${c.bufferSize}: nsdf |Δ| < 1e-4, |Δf| < 0.1 cent`, () => {
      const sig = c.signal(c.bufferSize)
      const fft = new MpmDetector(c.sr, { bufferSize: c.bufferSize })
      const dir = new MpmDetector(c.sr, { bufferSize: c.bufferSize, method: 'direct' })
      const rf = fft.push(sig)!
      const rd = dir.push(sig)!
      const tauMin = fft['tauMin'] as number
      const tauMax = fft['tauMax'] as number
      const nf = fft['nsdf'] as Float32Array
      const nd = dir['nsdf'] as Float32Array
      let maxDiff = 0
      for (let t = tauMin; t <= tauMax; t++) maxDiff = Math.max(maxDiff, Math.abs(nf[t] - nd[t]))
      expect(maxDiff).toBeLessThan(1e-4)
      expect(rf.rms).toBe(rd.rms)
      expect(Math.abs(rf.clarity - rd.clarity)).toBeLessThan(1e-4)
      expect(rf.frequency === 0).toBe(rd.frequency === 0)
      if (rd.frequency > 0) expect(Math.abs(cents(rf.frequency, rd.frequency))).toBeLessThan(0.1)
    })
  }

  for (const sr of [44100, 48000]) {
    for (const f of [82.41, 440, 1318.51]) {
      it(`direct method: ${f} Hz @ ${sr} Hz within ±1 cent`, () => {
        const r = last(new MpmDetector(sr, { method: 'direct' }), sine(f, sr, 3 * N), 512)
        expect(Math.abs(cents(r.frequency, f))).toBeLessThanOrEqual(1)
      })
    }
  }

  it('rejects an invalid method', () => {
    expect(() => new MpmDetector(48000, { method: 'dft' as never })).toThrow()
  })
})

describe('MpmDetector — benchmark (informational, no threshold)', () => {
  function bench(label: string, opts: Partial<MpmOptions>) {
    const sr = 48000
    const det = new MpmDetector(sr, opts)
    const hop = det['opts'].hopSize as number
    const chunk = sine(440, sr, hop) // loud sine → full NSDF path every push
    const warmup = 20
    const runs = 200
    for (let i = 0; i < warmup; i++) det.push(chunk)
    const times: number[] = []
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now()
      const r = det.push(chunk)
      times.push(performance.now() - t0)
      if (!r) throw new Error('expected one analysis per hop-sized push')
    }
    times.sort((a, b) => a - b)
    const mean = times.reduce((s, t) => s + t, 0) / runs
    const p95 = times[Math.floor(runs * 0.95)]
    console.log(
      `[mpm bench] ${label}: mean ${mean.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms per analyze (node ${process.version})`,
    )
    return mean
  }

  for (const bufferSize of [4096, 2048]) {
    it(`bufferSize ${bufferSize} @ 48 kHz: direct vs fft`, () => {
      const d = bench(`bufferSize ${bufferSize} @ 48kHz direct`, { bufferSize, method: 'direct' })
      const f = bench(`bufferSize ${bufferSize} @ 48kHz fft`, { bufferSize, method: 'fft' })
      console.log(`[mpm bench] bufferSize ${bufferSize} @ 48kHz speed-up: ${(d / f).toFixed(1)}x`)
    })
  }
})
