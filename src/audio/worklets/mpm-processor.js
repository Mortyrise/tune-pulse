// McLeod Pitch Method (NSDF + key-maximum picking + parabolic interpolation).
// Runs in AudioWorklet global scope: `sampleRate` and `AudioWorkletProcessor`
// are provided. No imports allowed here.

const BUFFER_SIZE = 4096
const HOP_SIZE = 512
const MIN_FREQ = 30
const MAX_FREQ = 5000
const CLARITY_THRESHOLD = 0.85
const RMS_THRESHOLD = 0.01
const KEY_MAX_RATIO = 0.93

class MPMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(BUFFER_SIZE)
    this.writeIdx = 0
    this.samplesSinceAnalysis = 0
    this.linear = new Float32Array(BUFFER_SIZE)
    this.tauMin = Math.max(2, Math.floor(sampleRate / MAX_FREQ))
    this.tauMax = Math.min(BUFFER_SIZE >> 1, Math.ceil(sampleRate / MIN_FREQ))
    this.nsdf = new Float32Array(this.tauMax + 1)
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel) return true

    const len = channel.length
    for (let i = 0; i < len; i++) {
      this.buffer[this.writeIdx] = channel[i]
      this.writeIdx = (this.writeIdx + 1) % BUFFER_SIZE
    }

    this.samplesSinceAnalysis += len
    if (this.samplesSinceAnalysis >= HOP_SIZE) {
      this.samplesSinceAnalysis = 0
      this.analyze()
    }
    return true
  }

  analyze() {
    const N = BUFFER_SIZE
    const lin = this.linear
    let sumSq = 0
    for (let i = 0; i < N; i++) {
      const s = this.buffer[(this.writeIdx + i) % N]
      lin[i] = s
      sumSq += s * s
    }
    const rms = Math.sqrt(sumSq / N)

    if (rms < RMS_THRESHOLD) {
      this.port.postMessage({ frequency: 0, clarity: 0, rms })
      return
    }

    const result = this.detectPitch(lin, N)
    this.port.postMessage({ frequency: result.frequency, clarity: result.clarity, rms })
  }

  detectPitch(x, N) {
    const tauMin = this.tauMin
    const tauMax = this.tauMax
    const nsdf = this.nsdf

    for (let tau = tauMin; tau <= tauMax; tau++) {
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

    // Find key maxima: peaks lying within positive regions between zero crossings.
    const peaks = []
    let pos = tauMin

    // Skip the initial positive region near tau=0.
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
      peaks.push(maxPos)
    }

    if (peaks.length === 0) {
      return { frequency: 0, clarity: 0 }
    }

    let highest = 0
    for (let i = 0; i < peaks.length; i++) {
      const v = nsdf[peaks[i]]
      if (v > highest) highest = v
    }

    const threshold = KEY_MAX_RATIO * highest
    let chosen = peaks[0]
    for (let i = 0; i < peaks.length; i++) {
      if (nsdf[peaks[i]] >= threshold) {
        chosen = peaks[i]
        break
      }
    }

    const clarity = nsdf[chosen]
    if (clarity < CLARITY_THRESHOLD) {
      return { frequency: 0, clarity }
    }

    // Parabolic interpolation for sub-sample precision.
    const alpha = chosen > tauMin ? nsdf[chosen - 1] : clarity
    const beta = clarity
    const gamma = chosen < tauMax ? nsdf[chosen + 1] : clarity
    const denom = alpha - 2 * beta + gamma
    const shift = denom !== 0 ? (0.5 * (alpha - gamma)) / denom : 0
    const refinedTau = chosen + shift

    return { frequency: sampleRate / refinedTau, clarity }
  }
}

registerProcessor('mpm-processor', MPMProcessor)
