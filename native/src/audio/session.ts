// Owned by task 04-shell. Shared audio context, session setup and permissions.
import { Platform } from 'react-native'
import {
  AudioContext,
  AudioManager,
  PlaybackNotificationManager,
} from 'react-native-audio-api'

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

export async function configureAudioSession(mode: SessionMode): Promise<void> {
  lastMode = mode
  if (configured) return
  AudioManager.setSystemOptions({
    ios: {
      category: 'playAndRecord',
      mode: USE_MEASUREMENT_MODE ? 'measurement' : 'default',
      options: ['defaultToSpeaker', 'allowBluetoothA2DP'],
    },
  })
  await AudioManager.setAudioSessionActivity(true)
  configured = true
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

/**
 * Keeps playback alive in the background. Android: the lib's foreground
 * service only runs while a notification is shown, so show one. iOS: no-op,
 * UIBackgroundModes audio is enough; showing the notification there would
 * enable lock-screen play/pause/skip buttons that nothing handles.
 */
export async function startBackgroundPlayback(title: string): Promise<void> {
  if (Platform.OS !== 'android') return
  if ((await AudioManager.checkNotificationPermissions()) === 'Undetermined') {
    await AudioManager.requestNotificationPermissions()
  }
  await PlaybackNotificationManager.show({ title, state: 'playing' })
  backgroundActive = true
}

export async function stopBackgroundPlayback(): Promise<void> {
  if (Platform.OS !== 'android' || !backgroundActive) return
  backgroundActive = false
  await PlaybackNotificationManager.hide()
}
