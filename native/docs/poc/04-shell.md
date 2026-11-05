# 04 — Shell: app config, audio session, build & device-test guide

Read `00-overview.md` first.

## Scope

- `app.json`: name "TunePulse", slug `tunepulse`, `ios.bundleIdentifier` / `android.package` = `com.bandpulse.tunepulse`, `userInterfaceStyle: automatic`. Plugins: `expo-dev-client`, the `react-native-audio-api` config plugin with mic permission text, iOS background audio (`UIBackgroundModes: ["audio"]`), Android `RECORD_AUDIO` + whatever the lib needs for background playback (foreground service / notification). Verify plugin option names in `node_modules/react-native-audio-api` (app.plugin.js / docs). Reconcile with what 03-metronome writes under "Requests to other tasks" (read its doc before finalising).
- `eas.json`: `development` (developmentClient, internal distribution, iOS device build), `preview` (internal APK), `production`.
- `src/audio/session.ts`: implement the contract — one shared `AudioContext`; `configureAudioSession(mode)` via the lib's `AudioManager` (iOS category: `playAndRecord` + defaultToSpeaker + allowBluetooth for tuner, `playback` for metronome — or one category that serves both if switching is problematic; justify); `requestMicPermission()` using the lib's permission API (verify).
- `App.tsx`: two tabs by state (Tuner / Metronome), safe area, pass `active` prop to each screen. Screens are owned by 02/03 — import `TunerScreen` from `src/screens/TunerScreen` and `MetronomeScreen` from `src/screens/MetronomeScreen` (default exports, prop `{ active: boolean }`).
- `README.md` (in `native/`): what this is, how to build a dev client with EAS (`npx eas-cli@latest build --profile development --platform ios|android`), install on device, `npx expo start --dev-client`, troubleshooting.
- `docs/poc/device-test-checklist.md`: step-by-step device tests with pass/fail boxes — tuner accuracy against a reference (another tuner app / tone generator at 440, 82.41, 1318.5 Hz), latency feel, metronome drift over 5 min vs. a reference, **screen locked 2 min**, app backgrounded, incoming notification, Bluetooth headphones, switching tabs while running.
- Delete the template `LICENSE` file if it's the default Expo MIT boilerplate (check first).

## Acceptance

- `npx expo-doctor` clean (or every warning explained), `npx expo config --type introspect` shows the permissions and background modes, `npx tsc --noEmit` passes once screens exist.

## Plan

Verified against installed `react-native-audio-api@1.0.0` (`src/plugin/withAudioAPI.ts`, `src/system/AudioManager.ts`, `src/system/types.ts`, iOS `AudioSessionManager.mm`, Android `ForegroundServiceManager.kt`), Expo v58 app config docs, EAS `eas.json` docs.

**app.json** (keep icon/adaptiveIcon/web assets as they are):
- `name: "TunePulse"`, `slug: "tunepulse"`, `userInterfaceStyle: "automatic"`, `ios.bundleIdentifier` / `android.package` = `com.bandpulse.tunepulse`.
- `plugins: ["expo-dev-client", ["react-native-audio-api", { iosMicrophonePermission: "TunePulse uses the microphone to detect the pitch of your instrument.", iosBackgroundMode: true, androidForegroundService: true, androidFSTypes: ["mediaPlayback"], androidFSStopWithTask: true, androidPermissions: [FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK, RECORD_AUDIO, POST_NOTIFICATIONS] }]]` (full `android.permission.*` names).
- Why list all four: the plugin's `androidPermissions` *replaces* its defaults (`{...defaults, ...options}`), and the lib's own AndroidManifest is empty, so RECORD_AUDIO and POST_NOTIFICATIONS (Android 13+, needed for the foreground-service notification) are not added by anyone else. iOS: plugin adds `UIBackgroundModes: ["audio"]` and `NSMicrophoneUsageDescription`.
- No `microphone` FS type: tuner records only in foreground; adding it would make Android require mic permission before any FS start (also for the metronome).
- Android note for 03: the foreground service (`CentralizedForegroundService`) only starts when a notification is shown (`PlaybackNotificationManager.show()` -> `NotificationRegistry` -> `ForegroundServiceManager.subscribe`). The manifest entry alone does nothing; 03 must show/hide the playback notification on start/stop.

**eas.json**: `cli: { version: ">= 16.0.0", appVersionSource: "remote" }`; `build.development: { developmentClient: true, distribution: "internal" }` (iOS device build = default, no `simulator`; needs `eas device:create` for ad-hoc UDIDs); `build.preview: { distribution: "internal", android: { buildType: "apk" } }`; `build.production: { autoIncrement: true }`. `eas init` will add `extra.eas.projectId` to app.json on first build (user does it; documented in README).

**session.ts** — single category, not switching:
- `getAudioContext()`: lazy module-level singleton `new AudioContext()` (default sampleRate = device preferred, `latencyHint` default interactive). Never closed.
- `configureAudioSession(mode)`: on first call `AudioManager.setSystemOptions({ ios: { category: 'playAndRecord', mode: 'default', options: ['defaultToSpeaker', 'allowBluetoothA2DP'] } })`, then `await AudioManager.setAudioSessionActivity(true)`; later calls are no-ops (mode kept in a module var for debug display). Android: nothing to configure (no `android` keys needed).
- Justification: `setAudioSessionOptions` in `AudioSessionManager.mm` calls `markSessionDeactivationInvalidatedGraph` and reconfigures the active session when the category changes -> switching tabs while the metronome runs would glitch/restart the graph (a checklist item). `playAndRecord` supports background playback with `UIBackgroundModes: audio`, `defaultToSpeaker` avoids earpiece routing, A2DP keeps BT headphones in stereo for clicks. Not using `allowBluetoothHFP` (the task said `allowBluetooth`; that option name does not exist in 1.0.0 — HFP drops output to telephone quality). Cost: orange mic dot only while the recorder runs, fine.
- Mode `default`, not `measurement`: measurement disables input AGC (better for pitch) but lowers speaker output; left as a one-line constant to flip during device tests.
- `requestMicPermission()`: `checkRecordingPermissions()`; `'Granted'` -> true; else `requestRecordingPermissions()` === `'Granted'`. Extra (non-breaking) export `requestNotificationPermission()` wrapping `requestNotificationPermissions()` for 03 to call before showing the Android notification.

**Permission flow**: no prompt at launch. TunerScreen (02) calls `requestMicPermission()` when it becomes active; on false it shows a message + button `Linking.openSettings()` (iOS won't re-prompt after Denied). Metronome never needs mic; on Android 13+ it asks notifications on first start (if denied, playback still works in foreground; background may be killed — checklist item).

**App.tsx**: `useState<'tuner'|'metronome'>`; root `View` with top inset (see Q1), header row of two `Pressable` tabs, both screens mounted at all times (hidden via `display: 'none'`) so the metronome keeps its state/engine when switching; `active={tab === 'tuner'}` etc. `StatusBar style="auto"`. No `configureAudioSession` call here — screens call it before starting audio (idempotent).

**README.md** outline: what/why (PoC goals), prerequisites (Expo account, `npx eas-cli@latest login`, Apple dev account for iOS), `eas init`, register iOS device, `build --profile development --platform ios|android`, install (QR/link), `npx expo start --dev-client` (same Wi-Fi or `--tunnel`), preview APK, troubleshooting (mic denied -> Settings, no sound with silent switch, BT routing, Android battery optimisation killing FS, rebuild needed after app.json/plugin changes).

**device-test-checklist.md** outline: header (device/OS/build id/date), sections with `- [ ] pass / fail / notes`: 1 install & permissions; 2 tuner accuracy at 440 / 82.41 / 1318.5 Hz vs reference (±cents), latency feel, stability; 3 metronome 120 BPM drift over 5 min vs reference metronome, BPM change while running; 4 screen locked 2 min; 5 app backgrounded (home, other app); 6 incoming notification / call / Siri interruption and recovery; 7 BT headphones (output, clicks latency); 8 switching tabs while metronome runs and while tuner listens; 9 Android notification permission denied case.

**LICENSE**: confirmed default Expo MIT (650 Industries) -> delete.

**Verification**: `npx tsc --noEmit` (after 02/03 screens exist), `npx expo-doctor`, `npx expo config --type introspect` and check: `ios.infoPlist.UIBackgroundModes` contains `audio`, `NSMicrophoneUsageDescription` set, Android manifest has the 4 permissions + `CentralizedForegroundService` with `foregroundServiceType="mediaPlayback"`. `npx expo lint` if configured.

**Open questions / dependency requests (not installed)**:
1. `react-native-safe-area-context` is not installed; RN 0.88 `SafeAreaView` is deprecated and iOS-only, and Android is edge-to-edge. Request to add it; fallback: RN `SafeAreaView` + `StatusBar.currentHeight` padding on Android.
2. `userInterfaceStyle: "automatic"` needs `expo-system-ui` on Android (per v58 docs) — add it, or accept that expo-doctor/Android ignores it.
3. iOS `mixWithOthers` (play along with a backing track) — off for PoC because it removes Now Playing controls; confirm.

## Result

Lead decisions applied: `userInterfaceStyle: "light"` (no expo-system-ui), `react-native-safe-area-context` for insets, no `mixWithOthers`, mode `default` with a `USE_MEASUREMENT_MODE` constant, MODIFY_AUDIO_SETTINGS added, background helpers added for 03.

**Files**
- `app.json`: name/slug/bundle id/package, `userInterfaceStyle: light`, plugins `expo-dev-client` + `react-native-audio-api` (iOS mic text, background audio, 5 Android permissions: RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK, POST_NOTIFICATIONS; foreground service `mediaPlayback`, stopWithTask).
- `eas.json`: `development` (dev client, internal), `preview` (internal, Android APK), `production` (autoIncrement); `appVersionSource: remote`.
- `src/audio/session.ts`: `getAudioContext()` (lazy singleton), `configureAudioSession(mode)` (single iOS config `playAndRecord` + `defaultToSpeaker` + `allowBluetoothA2DP`, then `setAudioSessionActivity(true)`; idempotent), `requestMicPermission()`, plus `requestNotificationPermission()`, `startBackgroundPlayback(title)`, `stopBackgroundPlayback()`, `getSessionMode()` (debug).
  - `startBackgroundPlayback` on Android: asks notification permission if `Undetermined`, then `PlaybackNotificationManager.show({ title, state: 'playing' })`, which starts `CentralizedForegroundService`. **iOS: no-op** — verified in `PlaybackNotification.mm` that showing it enables play/pause/next/prev/skip/seek remote commands on the lock screen, which nothing handles; `UIBackgroundModes: audio` alone keeps the session playing.
- `App.tsx`: `SafeAreaProvider` + `SafeAreaView`, two `Pressable` tabs by state, both screens mounted (hidden with `display: none`), `active` prop.
- `index.ts`: unchanged (template already registers `App`).
- `README.md`, `docs/poc/device-test-checklist.md`: written (9 sections incl. 03's lock/background 3-min tests and BPM change).
- `LICENSE`: deleted (default Expo MIT boilerplate).

**Verification (WSL)**
- `npx tsc --noEmit`: passes (with 02/03 screens now present).
- `npx expo-doctor`: 20/20 checks passed.
- `npx expo config --type introspect`: iOS `UIBackgroundModes: ["audio"]`, `NSMicrophoneUsageDescription` set; Android manifest has the 5 permissions and `com.swmansion.audioapi.system.CentralizedForegroundService` with `foregroundServiceType="mediaPlayback"`, `stopWithTask="true"`. Extra default Expo permissions also present (INTERNET, SYSTEM_ALERT_WINDOW, VIBRATE, READ/WRITE_EXTERNAL_STORAGE) — harmless for the PoC; could be removed via `android.blockedPermissions` later.
- `npx expo lint`: 0 errors in my files; 1 warning in `src/hooks/useTuner.ts:144` (02-owned, ref in effect cleanup) — not fixed.

**Not verifiable without a device**: that the session config actually routes to the speaker and survives lock/background, that the Android notification appears and keeps the service alive, Bluetooth behaviour, interruption recovery. All covered by the checklist.
