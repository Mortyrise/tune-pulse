// Owned by task 04-shell. Shared audio context, session setup and permissions.
import { Platform } from 'react-native'
import {
  AudioContext,
  AudioManager,
  PlaybackNotificationManager,
} from 'react-native-audio-api'
import { FocusRefCount, privateOutputIds } from './robustness'

export type SessionMode = 'tuner' | 'metronome'

// One iOS session config for both tabs. Changing the category while the
// session is active makes the lib rebuild the audio graph (see
// AudioSessionManager.mm, markSessionDeactivationInvalidatedGraph), which
// would glitch a running metronome when switching tabs. playAndRecord can
// play in the background (UIBackgroundModes: audio), defaultToSpeaker avoids
// the earpiece, A2DP keeps Bluetooth headphones in stereo.
// Flip to true to try 'measurement' mode (no input AGC, but quieter speaker).
const USE_MEASUREMENT_MODE = false

let context: AudioContext | null = null
let configured = false
let lastMode: SessionMode | null = null

export function getAudioContext(): AudioContext {
  if (!context) context = new AudioContext()
  return context
}

/** Last mode passed to configureAudioSession, for debug display. */
export function getSessionMode(): SessionMode | null {
  return lastMode
}

/**
 * Sets the iOS session options once, then (re)activates the session on every call: after an
 * interruption or a long background the session may be inactive again, and activation is
 * idempotent in the lib. iOS: also enables interruption events once (on iOS this only turns
 * event emission on; on Android the same call would request audio focus, see acquireFocus).
 */
export async function configureAudioSession(mode: SessionMode): Promise<void> {
  lastMode = mode
  if (!configured) {
    AudioManager.setSystemOptions({
      ios: {
        category: 'playAndRecord',
        mode: USE_MEASUREMENT_MODE ? 'measurement' : 'default',
        options: ['defaultToSpeaker', 'allowBluetoothA2DP'],
      },
    })
    if (Platform.OS === 'ios') AudioManager.observeAudioInterruptions(true)
    configured = true
  }
  await AudioManager.setAudioSessionActivity(true)
}

// --- audio focus (Android) ---------------------------------------------------

const focus = new FocusRefCount()

/**
 * Android: the first owner requests AUDIOFOCUS_GAIN (lib: observeAudioInterruptions('gain')),
 * which is also what makes the lib deliver `interruption` / `duck` events. Other media apps
 * pause while we hold it (same as iOS, where the session doesn't mix with others).
 * iOS: no-op (no focus concept; events enabled in configureAudioSession).
 */
export function acquireFocus(owner: string): void {
  if (focus.acquire(owner) === 'request' && Platform.OS === 'android') {
    try {
      AudioManager.observeAudioInterruptions('gain')
    } catch {
      // No focus means no interruption events; playback itself still works.
    }
  }
}

export function releaseFocus(owner: string): void {
  if (focus.release(owner) === 'abandon' && Platform.OS === 'android') {
    try {
      AudioManager.observeAudioInterruptions(false)
    } catch {
      // nothing to do
    }
  }
}

// --- system audio events ----------------------------------------------------

/** Lib events reduced to what the hooks need. */
export type RawAudioEvent =
  | { type: 'interruption'; began: boolean; shouldResume: boolean }
  | { type: 'duck' }
  /** 'NewDeviceAvailable' | 'OldDeviceUnavailable' | 'ConfigurationChange' | … (lib RouteChangeReason, not exported). */
  | { type: 'route'; reason: string }

type RawListener = (evt: RawAudioEvent) => void
const rawListeners = new Set<RawListener>()
let nativeSubs: { remove(): void }[] = []

function emitRaw(evt: RawAudioEvent) {
  for (const l of rawListeners) {
    try {
      l(evt)
    } catch {
      // a listener's failure must not break the others
    }
  }
}

/**
 * Subscribe to interruption / duck / route-change events. One native listener per event is
 * shared by every subscriber and removed when the last one leaves.
 */
export function subscribeAudioEvents(listener: RawListener): () => void {
  rawListeners.add(listener)
  if (nativeSubs.length === 0) {
    try {
      nativeSubs = [
        AudioManager.addSystemEventListener('interruption', (e) =>
          emitRaw({ type: 'interruption', began: e.type === 'began', shouldResume: !!e.shouldResume }),
        ),
        AudioManager.addSystemEventListener('duck', () => emitRaw({ type: 'duck' })),
        AudioManager.addSystemEventListener('routeChange', (e) => emitRaw({ type: 'route', reason: e.reason })),
      ]
    } catch {
      nativeSubs = []
    }
  }
  return () => {
    rawListeners.delete(listener)
    if (rawListeners.size === 0) {
      for (const s of nativeSubs) s.remove()
      nativeSubs = []
    }
  }
}

/** Ids of connected headphone / Bluetooth / USB outputs ([] if the query fails). */
export async function getPrivateOutputIds(): Promise<string[]> {
  try {
    return privateOutputIds(await AudioManager.getDevicesInfo(), Platform.OS)
  } catch {
    return []
  }
}

export async function requestMicPermission(): Promise<boolean> {
  if ((await AudioManager.checkRecordingPermissions()) === 'Granted') return true
  return (await AudioManager.requestRecordingPermissions()) === 'Granted'
}

export async function requestNotificationPermission(): Promise<boolean> {
  if ((await AudioManager.checkNotificationPermissions()) === 'Granted') return true
  return (await AudioManager.requestNotificationPermissions()) === 'Granted'
}

let backgroundActive = false

/** Android drawable copied in by task 13's config plugin; the lib falls back to its default icon. */
const NOTIFICATION_SMALL_ICON = 'ic_notification'

/**
 * Keeps playback alive in the background. Android: the lib's foreground service only runs
 * while a notification is shown, so show one, with a Pause action that stops the metronome
 * (see subscribeRemoteStop). If notification permission is denied (Android 13+) the service
 * still runs with the notification hidden, so background playback continues; we only ask while
 * the permission is undetermined. iOS: no-op, UIBackgroundModes audio is enough; showing the
 * notification there would enable lock-screen play/pause/skip buttons that nothing handles.
 */
export async function startBackgroundPlayback(title: string): Promise<void> {
  if (Platform.OS !== 'android') return
  if ((await AudioManager.checkNotificationPermissions()) === 'Undetermined') {
    await AudioManager.requestNotificationPermissions()
  }
  await PlaybackNotificationManager.show({ title, state: 'playing', androidSmallIcon: NOTIFICATION_SMALL_ICON })
  backgroundActive = true
  // hide() resets the controls, so enable Pause after every show. Android 13+ draws it from the
  // MediaSession state (-> playbackNotificationPause). On Android <= 12 the lib's receiver drops
  // the notification button's broadcast, so the button does nothing there (a headset key that
  // reaches the MediaSession still works).
  try {
    await PlaybackNotificationManager.enableControl('pause', true)
  } catch {
    // The notification still keeps the service alive without the button.
  }
}

export async function stopBackgroundPlayback(): Promise<void> {
  if (Platform.OS !== 'android' || !backgroundActive) return
  backgroundActive = false
  await PlaybackNotificationManager.hide()
}

/** Notification Pause/Stop (or a headset key routed to the MediaSession). Android only. */
export function subscribeRemoteStop(cb: () => void): () => void {
  if (Platform.OS !== 'android') return () => undefined
  try {
    const subs = [
      PlaybackNotificationManager.addEventListener('playbackNotificationPause', cb),
      PlaybackNotificationManager.addEventListener('playbackNotificationStop', cb),
    ]
    return () => subs.forEach((s) => s.remove())
  } catch {
    return () => undefined
  }
}
