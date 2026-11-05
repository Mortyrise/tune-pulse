# 03 — Metronome: native scheduler + background playback

Read `00-overview.md` first.

## Scope

- `src/audio/metronome.ts`: port `MetronomeEngine` from the web `src/audio/metronomeScheduler.ts` onto `react-native-audio-api` (`getAudioContext()` from `src/audio/session.ts`, owned by 04). Keep the config types (`MetronomeConfig`, `BeatEvent`…) and click styles. Replace `window.setInterval/setTimeout` with RN timers.
  - **Key risk: background.** JS timers are throttled or stopped when the app is backgrounded / screen locked. Investigate what the installed `react-native-audio-api` offers so clicks keep coming without the JS thread ticking every 25 ms. Options to evaluate (verify against the real API): (a) pre-render one bar (or N bars) into an `AudioBuffer` and play it with `AudioBufferSourceNode` `loop = true` — audio rendering continues natively in background; re-render on config change; (b) schedule a long horizon (several seconds) of oscillators; (c) anything the lib provides (e.g. a lock-screen / foreground-service helper). Recommend one, implement it, keep the lookahead scheduler only if it survives background.
  - BPM change while running must not glitch noticeably (state how).
  - Beat events for the UI while foregrounded (approximate is fine, derived from `currentTime`).
- `src/hooks/useMetronome.ts`: config state (bpm, numerator, subdivision on all beats, accent on beat 1), running, current beat. Haptic tick on downbeat with `expo-haptics` when foregrounded (optional toggle).
- `src/screens/MetronomeScreen.tsx`: minimal UI — BPM with −10/−1/+1/+10, numerator 2–7, subdivision 1–4, start/stop, beat dots, debug line (context state, sampleRate, mode used).
- Requirements for the shell (04 owns `app.json` / `session.ts`): list in your doc what background mode / audio session category / Android foreground-service config you need, with links to the lib docs.

## Acceptance

- `npx tsc --noEmit` passes.
- Clear written argument in `## Result` for why the chosen approach should keep playing with the screen locked on iOS and Android, and what to test on device.

## Plan

Checked against the installed `react-native-audio-api` **1.0.0** (`node_modules/react-native-audio-api`: `src/`, `app.plugin.js` → `src/plugin/withAudioAPI.ts`, Android `system/*.kt`).

### Approach: one pre-rendered bar, looped natively (option a)
- Render one bar of clicks into a mono `AudioBuffer` with the web click styles (sine, 1 ms linear attack, exponential decay; accent / downbeat / subdivision). Play it through `AudioBufferSourceNode` with `loop = true`, `loopStart = 0` and `loopEnd = buffer.duration` → `GainNode` → `destination`. Set `loopEnd` explicitly because the docs disagree on whether its default is 0 or the buffer duration.
- Once `start()` runs, the native audio thread renders the clicks. JS is not involved, so throttled or frozen timers in the background or with the screen locked cannot drop clicks. As long as the OS keeps the audio session or foreground service alive, playback continues (see the Requests section).
- Timing: click positions are `round(stepIndex * stepSamples)`, and the bar length is rounded to whole samples. Tempo error is at most 1 sample per bar, with no drift. Count-in is out of PoC scope.
- Rejected alternatives:
  - (b) Scheduling a long horizon of oscillators. The horizon still runs out unless JS refills it, it means hundreds of live nodes, and changing BPM means cancelling them.
  - (c) The web 25 ms lookahead scheduler. It needs the JS thread to tick, which is exactly what fails in the background.
  - `AudioBufferQueueSourceNode` (it exists). It needs JS to keep enqueueing, so it has the same weakness.
  - The lib has no metronome or background helper. `PlaybackNotificationManager` is only needed for the Android foreground service (see below).

### Config changes while running
- Verified: a source's `buffer` can be set **once only**. The setter throws "The buffer can only be set once", and `start()` can only be called once. A config change therefore means a new buffer and a new source, handed over at a sample-exact point:
  1. Find the next beat boundary `tB` at least 30 ms ahead of `currentTime`, using the anchor (`barStart`, `barDur`, `stepTimes`).
  2. Call `newSrc.start(tB, offset)` where `offset` is the position of the same beat index in the new bar. If that index is `>= newNumerator`, use 0 (a new bar starts). Then call `oldSrc.stop(tB)` and move the anchor.
  - A beat boundary always lands in the silence between clicks, so there is no click cut and no gap. The tempo change is heard from the next beat, with at most one beat of latency.
- Debounce config changes by about 120 ms so a burst of +1 taps builds one source, not ten. Release old sources in `onended`, or just drop references after `stop`.

### Beat events for the UI
- Beat events are derived purely from `ctx.currentTime` and the anchor: `pos = (t - barStart) mod barDur`, then binary-search `stepTimes` to get `{beat, subdivision, isAccent, isDownbeat}`.
- A `setInterval` of about 16 ms runs only while `AppState === 'active'`. It emits `onBeat` when the step changes. The `BeatEvent` type is kept, with phase always `'pattern'`.
- The interval stops on `background`/`inactive`. Audio is unaffected.
- The hook fires `Haptics.impactAsync` on the downbeat (toggle, foreground only).
- Not used: `onloopended` (bar-level only).

### Files (03-owned only)
- `src/audio/metronome.ts`: keeps the types and click styles. Contains the pure `buildBarLayout(cfg, sr)` and `renderBar(layout, sr) → Float32Array`, `stepAt(layout, pos)`, and `class MetronomeEngine { constructor(ctx), start(cfg), stop(), setConfig(cfg), setOnBeat(cb), running, mode }`.
- `src/hooks/useMetronome.ts`: config state (bpm 30–300, numerator 2–7, one subdivision 1–4 for all beats, accent on beat 1), `isRunning`, `activeBeat`, haptics toggle. Calls `configureAudioSession('metronome')`, the background start/stop helpers and `ctx.resume()`.
- `src/screens/MetronomeScreen.tsx`: BPM −10/−1/+1/+10, numerator, subdivision, start/stop, beat dots, debug line (`ctx.state`, `sampleRate`, `mode: 'loop-buffer'`, foreground service on or off).

### Verified API (v1.0.0)
- `ctx.createBuffer(channels, length, sampleRate): AudioBuffer`. Use `buf.copyToChannel(src: Float32Array, ch, start?)` and do not hold on to `getChannelData` views: they are live views that native cuts off once a source acquires the buffer.
- `ctx.createBufferSource(opts?: {pitchCorrection})`. Properties: `.buffer` (set once), `.loop`, `.loopStart`, `.loopEnd` (seconds). Methods and events: `start(when=0, offset=0, duration?)`, `stop(when=0)`, `onended`, `onloopended`.
- Context: `ctx.currentTime`, `ctx.sampleRate`, `ctx.state`, `resume()`, `suspend()`. `createGain()` and `connect()` are as in Web Audio.
- `AudioManager.setSystemOptions({ ios?: {category, mode, options, allowHaptics}, android?: {...} })`, `setAudioSessionActivity(enabled): Promise<void>`, `requestNotificationPermissions(): Promise<'Granted'|'Denied'|'Undetermined'>`.
- `PlaybackNotificationManager.show(info: {title, artist, state, ...}) / hide()`.

### Risks
- Android foreground service and OEM battery killers (Xiaomi, Samsung). iOS interruptions (calls, Siri) end the session. Handling interruptions is optional (`observeAudioInterruptions`).
- If 04 picks `playAndRecord` for the tuner and the session is not switched back, background playback still works, but output may route to the earpiece unless `defaultToSpeaker` is set.

### Requests to other tasks (04-shell)
1. **`app.json` plugin.** Passing `androidPermissions` *replaces* the plugin's default list, so the foreground-service permissions must be repeated ([getting started](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/getting-started), source `src/plugin/withAudioAPI.ts`):
   ```json
   ["react-native-audio-api", {
     "iosBackgroundMode": true,
     "iosMicrophonePermission": "TunePulse uses the microphone to tune your instrument.",
     "androidPermissions": ["android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS",
       "android.permission.FOREGROUND_SERVICE", "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
       "android.permission.POST_NOTIFICATIONS"],
     "androidForegroundService": true, "androidFSTypes": ["mediaPlayback"], "androidFSStopWithTask": true }]
   ```
   This adds `UIBackgroundModes: ["audio"]` and the `com.swmansion.audioapi.system.CentralizedForegroundService` service with type `mediaPlayback`. Verify with `npx expo config --type introspect`.
2. **`configureAudioSession('metronome')`:** call `AudioManager.setSystemOptions({ ios: { category: 'playback', mode: 'default', options: ['mixWithOthers'] } })`, then `await AudioManager.setAudioSessionActivity(true)`. The native default is already `AVAudioSessionCategoryPlayback`. `mixWithOthers` lets users play along with music, but it hides the iOS Now Playing controls. That is fine, see open question 1. ([AudioManager](https://docs.swmansion.com/react-native-audio-api/docs/system/audio-manager))
3. **Android foreground service.** Verified in `NotificationRegistry.kt` → `ForegroundServiceManager.subscribe`: the service starts **only** while a notification is shown. Please add these to `session.ts`:
   - `startBackgroundPlayback(title: string): Promise<void>`: on Android, `requestNotificationPermissions()` if Undetermined, then `PlaybackNotificationManager.show({ title, state: 'playing' })`.
   - `stopBackgroundPlayback(): Promise<void>`: `hide()`.

   The metronome calls them on start and stop. ([PlaybackNotificationManager](https://docs.swmansion.com/react-native-audio-api/docs/system/playback-notification-manager))
4. **Device checklist:** start the metronome, then (a) lock the screen and (b) switch to another app, for at least 3 minutes each on iOS and Android, and confirm clicks continue at a steady tempo. Change BPM while running and listen for any glitch.

## Result

Implemented after lead approval. The approval changed three things in the Plan:
- No `mixWithOthers`.
- The app uses a single iOS category, set by 04: `playAndRecord` with `defaultToSpeaker` and `allowBluetoothA2DP`. The metronome does not set a category itself. It only calls `configureAudioSession('metronome')`.
- The Android foreground service goes through 04's `startBackgroundPlayback` and `stopBackgroundPlayback`. Config is not persisted.

### Files
- `src/audio/metronomeLayout.ts` is pure TypeScript with no React Native imports. It holds the web types (`MetronomeConfig`, `BeatEvent` and the rest), the click styles, and these functions: `buildBarLayout`, `renderBar`, `stepAt`, `planHandover`, `stepToEvent`.
- `src/audio/metronome.ts` holds `MetronomeEngine`: `start(cfg)`, `stop()`, `setConfig(cfg)`, `setOnBeat(cb)`, `setUiActive(bool)`, `dispose()`, `running`. It also re-exports the layout module.
- `src/audio/metronome.test.ts` has 12 vitest tests. They cover sample-exact layout, tempo error ≤ 0.5 sample per bar, click styles, rendered peaks and silence, wraparound, `stepAt` lookup and wrapping, and the handover cases: next beat, shorter meter, bar rollover, exact boundary, loop not started yet.
- `src/hooks/useMetronome.ts`:
  - Config: bpm 30–300, numerator 2–7, one subdivision 1–4 for all beats, accent on beat 1, haptics toggle.
  - Start: `configureAudioSession('metronome')`, then `ctx.resume()`, then `engine.start`, then `startBackgroundPlayback('TunePulse metronome')`.
  - Stop: stops the engine, then calls `stopBackgroundPlayback()`.
  - UI polling runs only while `AppState === 'active'` and the tab is visible.
  - Haptics: `Haptics.impactAsync(Medium)` on beat 1 when the toggle is on.
- `src/screens/MetronomeScreen.tsx`:
  - Controls: BPM −10/−1/+1/+10, numerator chips, subdivision chips, accent and haptic switches, start/stop.
  - Display: beat dots and a debug line showing context state, sample rate, `mode: loop-buffer` and whether the background notification is on.
  - Takes `active` from App. The metronome keeps playing when the tab is hidden; `active` only gates polling.

`npx tsc --noEmit`, `npx vitest run src/audio` (12/12) and `npx expo lint` on the files above all pass.

### Why it should keep playing with the screen locked
- **No JS needed after start.** `start()` builds one bar of PCM, copies it into an `AudioBuffer` and plays it on an `AudioBufferSourceNode` with `loop = true` and `loopEnd = buffer.duration`. From then on the native render thread loops it. Nothing in JS ticks per click. JS runs only for config changes, which come from UI taps, and for UI beat polling, which is off in the background. Throttled or frozen JS timers therefore cannot drop clicks.
- **iOS:** the plugin adds `UIBackgroundModes: audio`, and the session is active and outputting sound, so iOS keeps the app and the audio unit running while locked. **Device check needed:** the session category is `playAndRecord`, not `playback`. Background output with `playAndRecord` plus the audio background mode is expected to work, but must be confirmed on a device. If it fails, the first thing to try is switching the category to `playback` while the metronome runs. That is 04's call, because a category change rebuilds the graph.
- **Android:** the lib's `CentralizedForegroundService` (type `mediaPlayback`) runs while the playback notification is shown, which `startBackgroundPlayback` does. That keeps the process at foreground priority, so the native audio stream keeps running with the screen off. Risk: aggressive OEM battery managers (Xiaomi, Samsung, Huawei). If notification permission is denied on Android 13+, the service should still run with the notification hidden. Check this on a device.
- **Config changes:** a source accepts only one buffer, so a change builds a new buffer and source.
  - The swap happens at the next beat boundary at least 30 ms ahead: `newSrc.start(tB, offsetOfSameBeat)` and `oldSrc.stop(tB)`. Both are scheduled on the audio clock, and the boundary falls in the silence between clicks, so there is no gap and no cut-off click. The new tempo is heard from the next beat.
  - Changes are debounced by 120 ms. Several queued swaps chain correctly; the engine keeps a list of segments.

### What to test on device (for `device-test-checklist.md`)
1. Start at 120 BPM, lock the screen for at least 3 minutes. The clicks should be steady and the tempo unchanged (compare with a reference metronome or a recording).
2. Same as 1, but switch to another app instead of locking.
3. Android: the "TunePulse metronome" notification appears while running and disappears on stop. Repeat test 1 with notification permission denied.
4. Unlock after a while: the debug line should show `ctx: running` and the beat dots should be back in sync.
5. While running, tap +1 quickly about 10 times, change the numerator from 4 to 3 on beat 4, and change subdivision 1 → 4 → 1. There should be no doubled or missing clicks, no pops, and the new tempo should apply within a beat.
6. Start the metronome, switch to the Tuner tab and start the tuner. Both should work, and sound should come from the speaker (`defaultToSpeaker`), not the earpiece. Repeat with Bluetooth headphones (A2DP).
7. Use haptics, then interrupt with a phone call or Siri. Recovering from an interruption is not handled in the PoC. Note what happens.

### Not verified here (no device)
All audio behaviour, latency of the first click (50 ms lead), and the exact iOS `playAndRecord` background behaviour. A note on the lib: `getChannelData` views are cut off when a source acquires the buffer. The engine uses `copyToChannel` into a fresh buffer, so this does not affect it.
