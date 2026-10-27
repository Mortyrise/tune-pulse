import mpmWorkletUrl from './worklets/mpm-processor.js?url'

export type PitchSample = {
  frequency: number
  clarity: number
  rms: number
}

export type PitchDetectorHandle = {
  stop: () => void
}

const workletLoaded: WeakSet<AudioContext> = new WeakSet()

export async function startPitchDetection(
  audioContext: AudioContext,
  mediaStream: MediaStream,
  onSample: (sample: PitchSample) => void,
): Promise<PitchDetectorHandle> {
  if (!workletLoaded.has(audioContext)) {
    await audioContext.audioWorklet.addModule(mpmWorkletUrl)
    workletLoaded.add(audioContext)
  }

  const source = audioContext.createMediaStreamSource(mediaStream)
  const node = new AudioWorkletNode(audioContext, 'mpm-processor')

  // Route through a muted gain so the graph is "live" without playing input back.
  const mute = audioContext.createGain()
  mute.gain.value = 0

  node.port.onmessage = (event) => {
    onSample(event.data as PitchSample)
  }

  source.connect(node)
  node.connect(mute)
  mute.connect(audioContext.destination)

  return {
    stop: () => {
      try {
        node.port.onmessage = null
        source.disconnect()
        node.disconnect()
        mute.disconnect()
      } catch {
        // disconnect on already-disconnected nodes throws — ignore.
      }
      mediaStream.getTracks().forEach((t) => t.stop())
    },
  }
}
