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

export function requestMicrophone(): Promise<MediaStream> {
  // IMPORTANT: this function must be called *synchronously* from a user
  // gesture handler (e.g. onClick), without any await in front of it. iOS
  // Safari otherwise loses the transient activation and rejects the prompt.
  const preferred: MediaStreamConstraints = {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  }
  return navigator.mediaDevices.getUserMedia(preferred).catch((err) => {
    // Some devices reject when these processing flags are forced off.
    if (err instanceof DOMException && err.name === 'OverconstrainedError') {
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    }
    throw err
  })
}
