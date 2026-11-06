// Pure robustness policy for interruptions, route changes and stalls (no React Native imports,
// tested with vitest). The hooks translate react-native-audio-api events into `AudioEvt` and
// apply the returned reaction. Facts this relies on (verified in the lib 1.0.0 source):
// - Android: `observeAudioInterruptions('gain')` is what requests audio focus; focus loss /
//   transient loss arrive as `interruption {began}`, regain as `{ended, shouldResume}`
//   (true only after a transient loss), CAN_DUCK as `duck` (the lib does not duck).
// - iOS: the same call only enables events; the native engine pauses/resumes itself.
// - `routeChange` on Android is any device add/remove (no BECOMING_NOISY), so "headphones
//   unplugged" is detected by diffing private outputs from `getDevicesInfo()`.
// - The AudioContext sample rate never changes (both platforms resample to it), so the
//   metronome bar never needs re-rendering after a route change.

/** Why the metronome stopped on its own (null = user stop / never started). */
export type PausedReason = 'interrupted' | 'route' | 'stalled' | 'error'

export type AudioEvt =
  | { kind: 'interruptionBegan' }
  | { kind: 'interruptionEnded'; shouldResume: boolean }
  | { kind: 'duck' }
  | { kind: 'routeLost'; lostPrivate: boolean }
  | { kind: 'routeAdded' }
  | { kind: 'contextError' }
  | { kind: 'stalled' }
  | { kind: 'remoteStop' }

export type ResumePolicy = {
  /** Auto-resume after an interruption that ended with shouldResume (transient loss). */
  autoResumeAfterTransient: boolean
  /** Only auto-resume if the interruption lasted at most this long. */
  maxAutoResumeMs: number
}

/**
 * v1 policy: never auto-resume, the user taps play. After a call or alarm the player's hands
 * and attention are elsewhere; clicks restarting on their own (maybe in the background) are
 * worse than one tap. iOS's engine also won't resume while input is active, so this keeps the
 * platforms aligned and avoids racing the lib's native restart. Config is persisted, so play
 * brings back the same groove.
 */
export const AUTO_RESUME_AFTER_TRANSIENT = false

export const DEFAULT_RESUME_POLICY: ResumePolicy = {
  autoResumeAfterTransient: AUTO_RESUME_AFTER_TRANSIENT,
  maxAutoResumeMs: 30_000,
}

/** Metronome state the policy needs. */
export type MetronomeRunState = {
  running: boolean
  /** Reason of the last automatic stop (null after a user stop/start). */
  pausedReason: PausedReason | null
  /** ms timestamp of the automatic stop, for the auto-resume window. */
  pausedAt: number | null
}

export type MetronomeReaction =
  | { action: 'none' }
  | { action: 'stop'; reason: PausedReason | null; message: string | null }
  | { action: 'resume' }

const NONE: MetronomeReaction = { action: 'none' }

export const PAUSED_MESSAGES: Record<PausedReason, string> = {
  interrupted: 'Paused by a call or another app. Tap play to resume.',
  route: 'Paused: headphones disconnected. Tap play to resume.',
  stalled: 'Audio stopped in the background. Tap play to resume.',
  error: 'Audio output stopped (device changed). Tap play to retry.',
}

export function metronomeReaction(
  state: MetronomeRunState,
  evt: AudioEvt,
  now: number,
  policy: ResumePolicy = DEFAULT_RESUME_POLICY,
): MetronomeReaction {
  switch (evt.kind) {
    case 'interruptionBegan':
      return state.running ? stopFor('interrupted') : NONE
    case 'interruptionEnded':
      if (
        !state.running &&
        policy.autoResumeAfterTransient &&
        evt.shouldResume &&
        state.pausedReason === 'interrupted' &&
        state.pausedAt !== null &&
        now - state.pausedAt <= policy.maxAutoResumeMs
      ) {
        return { action: 'resume' }
      }
      return NONE
    case 'duck':
      // Android 8+ ducks us automatically; a metronome should keep its time.
      return NONE
    case 'routeLost':
      return state.running && evt.lostPrivate ? stopFor('route') : NONE
    case 'routeAdded':
      return NONE
    case 'contextError':
      return state.running ? stopFor('error') : NONE
    case 'stalled':
      return state.running ? stopFor('stalled') : NONE
    case 'remoteStop':
      // Notification / headset pause: a plain user stop, no message.
      return state.running ? { action: 'stop', reason: null, message: null } : NONE
  }
}

function stopFor(reason: PausedReason): MetronomeReaction {
  return { action: 'stop', reason, message: PAUSED_MESSAGES[reason] }
}

export type TunerReaction = 'none' | 'stop' | 'restart'

/** The tuner holds no audio focus; it reacts to iOS interruptions and route changes. */
export function tunerReaction(busy: boolean, evt: AudioEvt): TunerReaction {
  if (!busy) return 'none'
  switch (evt.kind) {
    case 'interruptionBegan':
    case 'contextError':
      return 'stop'
    case 'routeLost':
    case 'routeAdded':
      // New input device and maybe a new preferred rate: restart cleanly.
      return 'restart'
    default:
      return 'none'
  }
}

export const TUNER_INTERRUPTED_MESSAGE = 'The microphone was interrupted by a call or another app.'

// --- outputs ---------------------------------------------------------------

export type DeviceLike = { id: string; category: string }
export type DevicesInfoLike = { availableOutputs: DeviceLike[]; currentOutputs: DeviceLike[] }

/**
 * Personal outputs whose loss should pause playback (platform "becoming noisy" convention).
 * Android categories come from MediaSessionManager.parseDeviceCategory ("Wired Headset",
 * "Bluetooth A2DP", "USB Headset", "Bluetooth LE Headset"…); iOS ones are AVAudioSession
 * port types ("Headphones", "BluetoothA2DPOutput", "BluetoothHFP", "BluetoothLE", "USBAudio").
 */
export function isPrivateOutput(category: string): boolean {
  const c = category.toLowerCase()
  if (c.includes('speaker') && !c.includes('headset')) return false // BT LE speaker, built-in
  return (
    c.includes('headset') ||
    c.includes('headphones') ||
    c.includes('bluetooth') ||
    c.includes('usb') ||
    c.includes('a2dp') ||
    c.includes('hfp')
  )
}

/**
 * Ids of connected private outputs. Android only reports `availableOutputs` (currentOutputs is
 * always empty); iOS reports the active route in `currentOutputs`.
 */
export function privateOutputIds(info: DevicesInfoLike, platform: string): string[] {
  const list = platform === 'ios' ? info.currentOutputs : info.availableOutputs
  return list.filter((d) => isPrivateOutput(d.category)).map((d) => d.id)
}

/** True when a private output present before is gone now. */
export function lostPrivateOutput(prev: readonly string[], next: readonly string[]): boolean {
  const now = new Set(next)
  return prev.some((id) => !now.has(id))
}

// --- stall check -------------------------------------------------------------

/**
 * The context clock should advance with wall time while running. Less than `minRatio` of the
 * wall interval (or a non-running state) means the output is silent.
 */
export function isContextStalled(
  t0: number,
  t1: number,
  wallMs: number,
  state: string,
  minRatio = 0.5,
): boolean {
  if (state !== 'running') return true
  if (wallMs <= 0) return false
  return (t1 - t0) * 1000 < wallMs * minRatio
}

// --- focus ref-count ----------------------------------------------------------

export type FocusTransition = 'request' | 'abandon' | null

/** Ref-counted audio-focus ownership. Returns the native call to make, if any. */
export class FocusRefCount {
  private readonly owners = new Set<string>()

  acquire(owner: string): FocusTransition {
    const was = this.owners.size
    this.owners.add(owner)
    return was === 0 && this.owners.size === 1 ? 'request' : null
  }

  release(owner: string): FocusTransition {
    if (!this.owners.delete(owner)) return null
    return this.owners.size === 0 ? 'abandon' : null
  }

  get held(): boolean {
    return this.owners.size > 0
  }
}
