// McLeod pitch detector running in AudioWorklet global scope.
// Single source of truth with the native app: the detector itself is
// native/src/core/mpm.ts (+ biquad.ts low-pass, fft.ts NSDF). Vite bundles this
// file and those imports into one classic script via `?worker&url` (see
// pitchDetector.ts). Native defaults = the web constants (window 4096, hop 512,
// 30–5000 Hz, clarity 0.85) plus the native fixes: τ-scan from τ=1, 5 kHz
// low-pass, rms gate 0.003, FFT NSDF (~0.5 ms vs ~7 ms per analysis).
import { MpmDetector } from '../../../native/src/core/mpm'

// AudioWorkletGlobalScope globals (TypeScript ships no AudioWorklet lib).
declare const sampleRate: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void

class MPMProcessor extends AudioWorkletProcessor {
  private readonly detector = new MpmDetector(sampleRate)

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (!channel) return true
    // One sample per hop (512 samples), including gated frames (frequency 0).
    const sample = this.detector.push(channel)
    if (sample) {
      this.port.postMessage({ frequency: sample.frequency, clarity: sample.clarity, rms: sample.rms })
    }
    return true
  }
}

registerProcessor('mpm-processor', MPMProcessor)
