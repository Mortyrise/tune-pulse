// Butterworth low-pass as cascaded biquads (bilinear transform, transposed
// direct form II, Float64 state). Stateful across calls so chunked input gives
// the same output as one-shot input. Used by MpmDetector to band-limit the mic
// signal before pitch analysis: the IIR phase shift doesn't change the period,
// and the group delay at fc = 5 kHz is ~0.08 ms.

export class ButterworthLowpass {
  private readonly coeffs: Float64Array // per section: b0 b1 b2 a1 a2
  private readonly state: Float64Array // per section: z1 z2
  private readonly sections: number

  /** @param order even, ≥ 2 (default 4 = two biquads). */
  constructor(sampleRate: number, cutoffHz: number, order = 4) {
    if (!(sampleRate > 0)) throw new Error(`ButterworthLowpass: invalid sampleRate ${sampleRate}`)
    if (!(cutoffHz > 0 && cutoffHz < sampleRate / 2)) {
      throw new Error(`ButterworthLowpass: cutoff ${cutoffHz} must be in (0, sr/2)`)
    }
    if (!(order >= 2) || order % 2 !== 0) throw new Error(`ButterworthLowpass: invalid order ${order}`)
    const n = order / 2
    this.sections = n
    this.coeffs = new Float64Array(5 * n)
    this.state = new Float64Array(2 * n)
    const w = Math.tan((Math.PI * cutoffHz) / sampleRate)
    const w2 = w * w
    for (let k = 0; k < n; k++) {
      // Pole-pair Q for a Butterworth of the given order.
      const q = 1 / (2 * Math.cos((Math.PI * (2 * k + 1)) / (2 * order)))
      const norm = 1 / (1 + w / q + w2)
      const c = 5 * k
      this.coeffs[c] = w2 * norm
      this.coeffs[c + 1] = 2 * w2 * norm
      this.coeffs[c + 2] = w2 * norm
      this.coeffs[c + 3] = 2 * (w2 - 1) * norm
      this.coeffs[c + 4] = (1 - w / q + w2) * norm
    }
  }

  /** Filter `input` into `output` (may be the same array). Lengths must match. */
  process(input: Float32Array, output: Float32Array): void {
    const len = input.length
    if (output !== input) output.set(input)
    const cf = this.coeffs
    const st = this.state
    for (let k = 0; k < this.sections; k++) {
      const c = 5 * k
      const b0 = cf[c], b1 = cf[c + 1], b2 = cf[c + 2], a1 = cf[c + 3], a2 = cf[c + 4]
      let z1 = st[2 * k]
      let z2 = st[2 * k + 1]
      for (let i = 0; i < len; i++) {
        const x = output[i]
        const y = b0 * x + z1
        z1 = b1 * x - a1 * y + z2
        z2 = b2 * x - a2 * y
        output[i] = y
      }
      st[2 * k] = z1
      st[2 * k + 1] = z2
    }
  }

  reset(): void {
    this.state.fill(0)
  }
}
