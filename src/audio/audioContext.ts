let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor({ latencyHint: 'interactive' })
  }
  return ctx
}

export async function resumeAudioContext(): Promise<void> {
  const c = getAudioContext()
  if (c.state === 'suspended') {
    await c.resume()
  }
}

export async function requestMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    },
    video: false,
  })
}
