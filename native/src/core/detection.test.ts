// 06-tuner-detection: low E2 in noise, high notes up to C8, noise-only false
// positives, RMS-gate sustain, debug fields, and the input low-pass itself.
import { describe, expect, it } from 'vitest'
import { ButterworthLowpass } from './biquad'
import { DEFAULT_MPM_OPTIONS, MpmDetector, type MpmOptions, type MpmRejectReason } from './mpm'
import { harmonicTone, lowpassDecimate, noiseSignal, pluck } from './testSignals'

const OLD: Partial<MpmOptions> = { lowpassHz: 0, rmsThreshold: 0.01 }

type Frame = { t: number; frequency: number; clarity: number; rms: number; reason: MpmRejectReason }

/** Run the tuner's cadence (hop = window/2) and collect every analysis. */
function analyse(x: Float32Array, sr: number, window: number, opts: Partial<MpmOptions> = {}): Frame[] {
  const hop = window >> 1
  const det = new MpmDetector(sr, { bufferSize: window, hopSize: hop, ...opts })
  const out: Frame[] = []
  for (let i = 0; i + hop <= x.length; i += hop) {
    const s = det.push(x.subarray(i, i + hop))
    if (s && i >= window) out.push({ t: (i + hop) / sr, ...s, reason: det.lastDebug.reason })
  }
  return out
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b)
const near = (f: number, f0: number) => f > 0 && Math.abs(cents(f, f0)) < 50

/** Fraction of frames in [0.2, 2.0] s detected within ±50 ¢ of f0. */
function detectionRate(frames: Frame[], f0: number): number {
  const inRange = frames.filter((q) => q.t >= 0.2 && q.t <= 2.0)
  return inRange.filter((q) => near(q.frequency, f0)).length / inRange.length
}

/** End time (s) of the first unbroken run of correct detections. */
function sustainEnd(frames: Frame[], f0: number): number {
  let end = 0
  let started = false
  for (const q of frames) {
    if (near(q.frequency, f0)) {
      started = true
      end = q.t
    } else if (started) break
  }
  return end
}

describe('E2 pluck in white noise (48 kHz, window 4096)', () => {
  const x48 = pluck({ noise: 0.008 })

  it('old pipeline (no low-pass) misses it; filtered pipeline catches it; light sits between', () => {
    const old = detectionRate(analyse(x48, 48000, 4096, OLD), 82.41)
    const neu = detectionRate(analyse(x48, 48000, 4096), 82.41)
    const light = detectionRate(analyse(lowpassDecimate(x48, 48000, 11500, 2), 24000, 2048, OLD), 82.41)
    expect(old).toBeLessThan(0.75)
    expect(light).toBeGreaterThanOrEqual(0.8)
    expect(neu).toBeGreaterThanOrEqual(0.95)
  })

  it('old-pipeline failures are clarity rejections, not gate/octave errors', () => {
    const frames = analyse(x48, 48000, 4096, OLD).filter((q) => q.t >= 0.2 && q.t <= 2.0)
    const misses = frames.filter((q) => !near(q.frequency, 82.41))
    expect(misses.length).toBeGreaterThan(0)
    for (const q of misses) {
      expect(q.reason).toBe('clarity')
      expect(q.frequency).toBe(0)
    }
  })

  it('works at 44.1 kHz too', () => {
    const x = pluck({ noise: 0.008, sampleRate: 44100 })
    expect(detectionRate(analyse(x, 44100, 4096), 82.41)).toBeGreaterThanOrEqual(0.95)
  })
})

describe('high notes up to C8 (harmonic tones)', () => {
  for (const sr of [44100, 48000]) {
    for (const f of [82.41, 440, 1318.51, 2093, 3520, 4186.01]) {
      it(`${f} Hz @ ${sr} within ±1 cent`, () => {
        const frames = analyse(harmonicTone(f, sr, sr, 4), sr, 4096)
        expect(frames.length).toBeGreaterThan(5)
        for (const q of frames) expect(Math.abs(cents(q.frequency, f))).toBeLessThanOrEqual(1)
      })
    }
  }

  it('C8 @ 48 kHz read an octave low on the old pipeline (regression guard)', () => {
    const frames = analyse(harmonicTone(4186.01, 48000, 48000, 4), 48000, 4096, OLD)
    expect(frames.some((q) => q.frequency > 0 && Math.abs(cents(q.frequency, 4186.01)) > 600)).toBe(true)
  })
})

describe('noise only: no false notes', () => {
  for (const color of ['white', 'pink'] as const) {
    for (const std of [0.002, 0.008, 0.05]) {
      it(`${color} σ=${std} → 0 voiced frames`, () => {
        const frames = analyse(noiseSignal(48000 * 10, std, color, 3), 48000, 4096)
        expect(frames.length).toBeGreaterThan(200)
        expect(frames.filter((q) => q.frequency > 0)).toHaveLength(0)
        for (const q of frames) expect(q.clarity).toBeLessThan(0.6)
      })
    }
  }
})

describe('RMS gate sustain (decaying E2, quiet room)', () => {
  it('default gate keeps the note voiced ≥ 1 s longer than the old 0.01 gate', () => {
    const x = pluck({ seconds: 8, noise: 0.0005, peak: 0.3 })
    const oldEnd = sustainEnd(analyse(x, 48000, 4096, OLD), 82.41)
    const newEnd = sustainEnd(analyse(x, 48000, 4096), 82.41)
    expect(DEFAULT_MPM_OPTIONS.rmsThreshold).toBe(0.003)
    expect(newEnd - oldEnd).toBeGreaterThanOrEqual(1)
  })
})

describe('MpmDetector.lastDebug', () => {
  it('reports gate / clarity / ok with raw frequency and both RMS values', () => {
    const det = new MpmDetector(48000, { hopSize: 4096 })
    det.push(new Float32Array(4096))
    expect(det.lastDebug.reason).toBe('gate')
    expect(det.lastDebug.rawFrequency).toBe(0)

    det.reset()
    det.push(harmonicTone(440, 48000, 4096, 1))
    expect(det.lastDebug.reason).toBe('ok')
    expect(Math.abs(cents(det.lastDebug.rawFrequency, 440))).toBeLessThan(1)

    // Clarity rejection: keeps a candidate frequency and clarity.
    const strict = new MpmDetector(48000, { hopSize: 4096, clarityThreshold: 0.9999 })
    const x = pluck({ noise: 0.02, seconds: 0.5 })
    strict.push(x.subarray(0, 8192))
    expect(strict.lastDebug.reason).toBe('clarity')
    expect(strict.lastDebug.rawFrequency).toBeGreaterThan(0)
    expect(strict.lastDebug.clarity).toBeGreaterThan(0)
  })

  it('rmsUnfiltered ≥ rms with the filter on; equal with it off', () => {
    const x = noiseSignal(8192, 0.05, 'white')
    const on = new MpmDetector(48000, { hopSize: 8192 })
    on.push(x)
    // White noise: ~5/24 of the power is below 5 kHz → rms ratio ≈ 0.46.
    const ratio = on.lastDebug.rms / on.lastDebug.rmsUnfiltered
    expect(ratio).toBeGreaterThan(0.38)
    expect(ratio).toBeLessThan(0.54)
    const off = new MpmDetector(48000, { hopSize: 8192, lowpassHz: 0 })
    off.push(x)
    expect(off.lastDebug.rmsUnfiltered).toBe(off.lastDebug.rms)
    expect(off.lowpassHz).toBe(0)
    expect(on.lowpassHz).toBe(5000)
  })

  it('filter auto-disables when the cutoff is ≥ 0.45·sampleRate', () => {
    expect(new MpmDetector(8000).lowpassHz).toBe(0)
    expect(new MpmDetector(11025).lowpassHz).toBe(0)
    expect(new MpmDetector(16000).lowpassHz).toBe(5000)
  })
})

describe('ButterworthLowpass', () => {
  function gainAt(f: number, sr = 48000, fc = 5000): number {
    const lp = new ButterworthLowpass(sr, fc)
    const n = sr
    const x = new Float32Array(n)
    for (let i = 0; i < n; i++) x[i] = Math.sin((2 * Math.PI * f * i) / sr)
    lp.process(x, x)
    let p = 0
    for (let i = n >> 1; i < n; i++) p += x[i] * x[i]
    return 10 * Math.log10(p / (n >> 1) / 0.5)
  }

  it('−3 dB at fc, flat in the passband, steep above', () => {
    expect(Math.abs(gainAt(5000) + 3.01)).toBeLessThan(0.1)
    expect(Math.abs(gainAt(440))).toBeLessThan(0.01)
    expect(gainAt(4186)).toBeGreaterThan(-1) // −0.87 dB (bilinear warping)
    expect(gainAt(10000)).toBeLessThan(-23)
    expect(gainAt(20000)).toBeLessThan(-45)
  })

  it('chunked processing equals one-shot; reset clears state', () => {
    const x = noiseSignal(5000, 0.3, 'white', 11)
    const a = new Float32Array(x)
    const lp = new ButterworthLowpass(48000, 5000)
    lp.process(a, a)
    const b = new Float32Array(x.length)
    const lp2 = new ButterworthLowpass(48000, 5000)
    for (let off = 0; off < x.length; off += 333) {
      const end = Math.min(off + 333, x.length)
      lp2.process(x.subarray(off, end), b.subarray(off, end))
    }
    expect(Array.from(b)).toEqual(Array.from(a))
    lp2.reset()
    const c = new Float32Array(x)
    lp2.process(c, c)
    expect(Array.from(c)).toEqual(Array.from(a))
  })

  it('rejects invalid parameters', () => {
    expect(() => new ButterworthLowpass(48000, 24000)).toThrow()
    expect(() => new ButterworthLowpass(48000, 0)).toThrow()
    expect(() => new ButterworthLowpass(48000, 5000, 3)).toThrow()
  })
})
