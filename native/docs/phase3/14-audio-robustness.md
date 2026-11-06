# 14 — Audio robustness: interruptions, routes, lifecycle

Read `00-overview.md`, `../poc/03-metronome.md`, `../poc/04-shell.md`, `../phase2/11-metronome-screen.md` (Results).

## Scope (verify every API in node_modules/react-native-audio-api 1.0.0 — don't trust memory)
- **Interruptions**: phone call, alarm, another app taking audio focus (Android audio focus loss / transient loss / duck; iOS interruption began/ended). Metronome: pause cleanly and reflect it in UI state (not "running" while silent); decide resume policy (auto-resume after transient loss vs. user taps play) and justify. Tuner: stop/restart recorder cleanly. Look at `AudioManager.observeAudioInterruptions` / audio focus events in the lib.
- **Route changes**: headphones / Bluetooth connect & disconnect mid-session (Android "becoming noisy" → pause metronome is the platform convention), sample-rate changes after route change (tuner detector must rebuild; metronome bar must re-render at new rate if the context rate changes).
- **Lifecycle**: app killed while metronome runs (foreground service + notification teardown, `androidFSStopWithTask`), notification permission denied → background behaviour, battery saver / Doze (document what we can't control), AudioContext state after long background (`suspended`/`interrupted` → resume on start).
- **Errors** surfaced to the hooks' `error` state with user-readable messages; no unhandled promise rejections.
- Pure logic (policy decisions, state machine) in testable functions with vitest.
- Add a "robustness" section to the device checklist **as a list in your Result** (15 owns the checklist file; it will merge it).

## Acceptance
tsc / vitest / lint clean; Result lists each scenario → expected behaviour → how it's implemented → how to test on device.

## Plan

**Verified in node_modules/react-native-audio-api 1.0.0** (I read the source; nothing here comes from memory):
- `AudioManager.observeAudioInterruptions('gain' | true | false)`.
  - **Android:** this call is what requests audio focus (`AudioFocusListener.requestAudioFocus`), and `false` abandons it. **The app never calls it today, so on Android we hold no focus and get no events.**
  - **Android event mapping:**
    - LOSS → `interruption {began, shouldResume:false}`.
    - LOSS_TRANSIENT → the same event, and the lib remembers it was transient.
    - GAIN → `{ended, shouldResume: wasTransient}`.
    - CAN_DUCK → `duck`. The lib does no ducking itself.
  - **iOS:** the call only turns event emission on. The native engine pauses by itself on an interruption. On `ended` it restarts only when `shouldResume` is set and there is playback but no input (`shouldEngineResumeAfterInterruption`).
- `addSystemEventListener('routeChange', {reason})`.
  - **Android:** sends `NewDeviceAvailable` / `OldDeviceUnavailable` from an `AudioDeviceCallback`, for any device. There is **no BECOMING_NOISY**.
  - **iOS:** sends the AVAudioSession reasons.
  - **Devices:** `getDevicesInfo()` returns `category` strings ("Wired Headset", "Bluetooth A2DP", "USB Headset", "Bluetooth LE Headset"…). Android fills only `availableOutputs`; iOS also fills `currentOutputs`.
- **Context sample rate never changes.**
  - Android: the oboe stream is reopened with `setSampleRate(ctx rate)` plus conversion, on disconnect too.
  - iOS: the source node uses the context's format and AVAudioEngine converts.
  - `BaseAudioContext.sampleRate` is readonly.
  - So the metronome bar never needs re-rendering at a new rate.
  - The recorder resamples to the rate we request, and on Android it restarts capture by itself after a disconnect. The tuner already rebuilds its detector if `buffer.sampleRate` changes.
- `ContextState` has no `'interrupted'`, only `running | suspended | closed`.
  - On Android, if rebuilding the stream fails, `onStreamFail` stops the driver and fires `ctx.onerror` **without changing `state`**, so `state` can read `'running'` while nothing plays.
  - `ctx.resume()` restarts the driver in that case and resolves straight away when the driver is healthy, so it is safe to call every time.
- **Foreground service:**
  - Swiping a notification away only emits `playbackNotificationDismissed`. The FGS stays subscribed until `hide()`.
  - With `stopWithTask=true`, removing the task destroys the service, and the process and its audio go with it.
  - The notification has no controls by default (`controls = 0`).
  - `androidSmallIcon` (string, or `{uri}`) is read by `PlaybackNotification.resolveSmallIconResource`. If the resource isn't found it falls back to `ic_media_play`.

**Scenarios: expected behaviour and how it is implemented**
1. **Phone call, alarm, another app takes focus (permanent or transient loss; iOS interruption began)**
   - Metronome: stops cleanly. `engine.stop()`, `isRunning=false`, notification hidden, and `pausedReason='interrupted'` so the UI can say "Paused: interrupted. Tap play".
   - Tuner: `stop()`, then `error {kind:'interrupted'}` with a readable message.
   - Code: `session.ts` gets `subscribeAudioEvents()`, a single native listener that fans out to the hooks; the provider and `useTuner` subscribe.
2. **Interruption ended:** policy below (no auto-resume). We only clear focus bookkeeping.
3. **Duck (Android CAN_DUCK):** ignore. Android 8+ ducks us automatically, and a metronome should keep its time.
4. **Focus ownership:** `acquireFocus(owner)` / `releaseFocus(owner)` in session.ts, reference-counted over metronome and tuner.
   - Calls `observeAudioInterruptions('gain')` on the first acquire and `(false)` on the last release.
   - iOS: we call `observeAudioInterruptions(true)` once.
   - Side effect: starting the metronome pauses Spotify and similar apps on Android. That matches iOS, where we don't use `mixWithOthers`.
5. **Headphones or Bluetooth disconnect (`OldDeviceUnavailable`)**
   - Metronome: stops with `pausedReason='route'`. This is the platform convention, so clicks don't jump to the speaker.
   - How it is detected: snapshot the private outputs at start and on `NewDeviceAvailable`. On `OldDeviceUnavailable`, re-read them and stop only if a private output disappeared. This is the pure function `lostPrivateOutput`.
   - Tuner: restarted with the same preset, debounced by 500 ms. It picks up the new input and rate; if the restart fails, the error goes to `error`.
6. **Headphones or Bluetooth connect (`NewDeviceAvailable`):** the metronome keeps playing (the lib reroutes) and the snapshot is refreshed. The tuner restarts as in 5.
7. **Sample-rate change:** nothing to do (see above). The engine keeps using `ctx.sampleRate`. I'll add a code comment and a diagnostics field that compares `deviceRate` with `ctxRate`.
8. **`ctx.onerror` (output stream lost):** stop with `error='Audio output stopped (device changed). Tap play.'`. The next start calls `ctx.resume()` without the state check.
9. **Long background or app returns to foreground (`AppState → active` while `isRunning`):**
   - Check health: `currentTime` should advance at least 50 % of wall time over 300 ms, and `state` should be `'running'`.
   - If not, stop with `pausedReason='stalled'`, so the UI never shows "running" while silent.
   - The start path always calls `setAudioSessionActivity(true)` and `ctx.resume()`. Today `configured` short-circuits the activation; I'll split options (set once) from activation (on every start).
10. **App killed while running:** `stopWithTask` tears down the FGS and its notification with the process. Nothing to persist; the config is already persisted. Device check: swipe the app away and confirm the notification goes.
11. **Notification permission denied (Android 13+):** asked once, when it is still `Undetermined`. The FGS still starts with the notification hidden, so background playback continues. No nagging. **Dismissed notification:** ignored; the FGS keeps running until stop.
12. **Doze, battery saver, OEM killers:** a mediaPlayback FGS with audio playing is exempt from Doze, and the clicks are native. We can't control OEM task killers (Xiaomi, Samsung "sleeping apps"). This goes in the Result and the checklist; there is no code for it.
13. **Errors:** every native call in the hooks is wrapped, and only readable messages reach `error`.
    - `stopBackgroundPlayback`, `releaseFocus` and the listener cleanups use `.catch` / try.
    - The tuner gets a new error kind, `'interrupted'`, and `TunerScreen`'s `errorCopy` must handle it.
    - `errorCopy` lives in `tuner-ui/format.ts`, which isn't my file, so I'll ask the coordinator first. The fallback is to reuse `'other'` with a clear message.
14. **From 13:** `startBackgroundPlayback` passes `androidSmallIcon: 'ic_notification'` to `show()` (option name verified above).

**Resume policy: never auto-resume; the user taps play.** Reasons:
- After a call or alarm, the player's hands and attention are elsewhere. Clicks coming back on their own, possibly in the background or through a speaker after headphones were unplugged, are worse than one tap.
- iOS's native engine already won't resume when input is active, so the two platforms behave the same.
- It avoids races with the lib's native restart.
- Android only *allows* resuming after a transient loss; it doesn't require it.
- The config is persisted, so play brings back the exact same groove.

This is one constant, `AUTO_RESUME_AFTER_TRANSIENT = false`, in the pure policy, so the lead can flip it. If it is on: resume when `ended.shouldResume` arrives within 30 s and the user hasn't touched anything.

**Pure, testable code:** new `src/audio/robustness.ts`, no React Native imports.
- `type AudioEvt = {kind:'interruptionBegan'} | {kind:'interruptionEnded', shouldResume} | {kind:'duck'} | {kind:'routeLost', lostPrivate:boolean} | {kind:'routeAdded'} | {kind:'contextError'} | {kind:'stalled'}`
- `metronomeReaction(running, evt, policy) → {action:'none'|'stop'|'resume', reason?: PausedReason, message?}`
- `tunerReaction(busy, evt) → 'none'|'stop'|'restart'`
- `isPrivateOutput(category)`, `privateOutputIds(info, platform)`, `lostPrivateOutput(prevIds, nextIds)`
- `isContextStalled(t0, t1, wallMs)`
- `FocusRefCount`, whose acquire/release return a `'request' | 'abandon' | null` transition.

**Tests:** `src/audio/robustness.test.ts` (about 20 vitest cases) covers every event × running/idle, the policy flag, the device diff (A2DP or wired removed vs. speaker-only change vs. SCO flapping), the stall threshold and the focus ref-count. `metronomeEngine.test.ts` gets one more case: `stop()` after a simulated error leaves `running=false`.

**Files:** `src/audio/session.ts`, `src/audio/robustness.ts` (+ test), `src/hooks/useMetronome.ts` (adds `pausedReason` to the returned API), `src/hooks/useTuner.ts`, `src/audio/tuner.ts` (error kind). The screen that shows `pausedReason` is not mine; I'll ask the coordinator about it.

## Result

I implemented the plan after the coordinator approved it. Their decisions:
- The metronome takes audio focus (`'gain'`). The tuner does not.
- No auto-resume. The constant stays so this can be switched later.
- I was allowed minimal edits to `MetronomeScreen.tsx` and `tuner-ui/format.ts`.
- The notification gets a Stop action. In practice this is the lib's Pause control; see below for why.

Checks: `npx tsc --noEmit` is clean, `npx expo lint` is clean, and `npx vitest run` passes (18 files, 255 tests). Nothing was installed and nothing committed.

### Files
- **New `src/audio/robustness.ts`** (pure logic) holds:
  - `AudioEvt` and `metronomeReaction(state, evt, now, policy)`, which returns none, stop (with reason and message) or resume.
  - `tunerReaction(busy, evt)`, which returns none, stop or restart.
  - `AUTO_RESUME_AFTER_TRANSIENT = false` and `DEFAULT_RESUME_POLICY`. If the flag is turned on, the metronome auto-resumes only when the interruption ends with `shouldResume` within 30 s.
  - `PAUSED_MESSAGES`.
  - `isPrivateOutput`, `privateOutputIds(info, platform)`, `lostPrivateOutput`.
  - `isContextStalled`.
  - `FocusRefCount`.
- **New `src/audio/robustness.test.ts`:** 16 tests.
- **`src/audio/session.ts`:**
  - `configureAudioSession` now sets the options once but re-activates the session on every call. On iOS it also turns on `observeAudioInterruptions(true)` once.
  - New `acquireFocus` / `releaseFocus`. They are ref-counted, and on Android they request (`'gain'`) and abandon focus.
  - New `subscribeAudioEvents`: one shared native listener each for `interruption`, `duck` and `routeChange`, fanned out to subscribers.
  - New `getPrivateOutputIds`.
  - `startBackgroundPlayback` now passes `androidSmallIcon: 'ic_notification'` (for 13) and enables the `pause` control after each `show()`.
  - New `subscribeRemoteStop`, which listens for `playbackNotificationPause` and `playbackNotificationStop`.
- **`src/hooks/useMetronome.ts`:**
  - Exposes `pausedReason` and `pausedMessage`.
  - Takes focus on start and releases it on stop, on unmount and when start fails.
  - Always awaits `ctx.resume()` on start.
  - While running, it subscribes to system events, notification stop and `ctx.onerror`.
  - When the app comes back to the foreground, it runs a stall check.
  - Error messages are now readable.
- **`src/hooks/useTuner.ts`:**
  - An interruption stops the tuner with `error {kind:'interrupted'}`.
  - A device being added or removed restarts it with the same preset: debounced 500 ms, and ignored for 1.5 s after a start so the mic opening can't cause a restart loop.
  - It holds no focus.
- **`src/audio/tuner.ts`:** `TunerErrorKind` gains `'interrupted'`.
- **`src/tuner-ui/format.ts`:** `errorCopy('interrupted')` shows "Tuner paused", with a test.
- **`src/screens/MetronomeScreen.tsx`:** shows `pausedMessage` in `colors.muted`, above the existing error line, while stopped.

### Scenario → expected behaviour → how it works
| Scenario | Expected | How |
|---|---|---|
| Phone call, alarm, Siri, another app's playback (focus loss / transient loss; iOS interruption began) | Metronome stops and hides its notification; the UI shows "Paused by a call or another app. Tap play to resume." The tuner shows the "Tuner paused" error. | `interruption {began}` → `metronomeReaction` returns stop, reason `interrupted`; `tunerReaction` returns stop. On Android these events only arrive while we hold focus, i.e. while the metronome runs. |
| Interruption ends | Nothing happens; the user taps play. | `AUTO_RESUME_AFTER_TRANSIENT = false`. The reasons: hands and attention are elsewhere after a call, sound coming back by itself is surprising, iOS doesn't resume while input is active, it avoids racing the lib's native restart, and the config is persisted so play restores the same groove. |
| Duck (Android CAN_DUCK, e.g. a notification sound) | Keeps playing. | Ignored. Android 8+ ducks automatically, and a metronome should keep its timing. |
| Headphones or Bluetooth disconnected | Metronome stops: "Paused: headphones disconnected." The tuner restarts on the new input. | On `OldDeviceUnavailable`, the private outputs (headphone, BT, USB categories) are compared with the snapshot taken at start or at the last `NewDeviceAvailable`. Android has no BECOMING_NOISY in the lib, so this diff stands in for it. iOS uses `currentOutputs`. |
| Headphones or Bluetooth connected | Metronome keeps playing on the new route. The tuner restarts. | The snapshot is refreshed. The lib reroutes; Android reopens the oboe stream at the context's rate. |
| Sample-rate change after a route change | Nothing visible. | The context rate is fixed for its whole life on both platforms (Android reopens with `setSampleRate(ctx rate)` plus conversion; iOS converts in AVAudioEngine), so the metronome bar stays valid. The recorder resamples to the requested rate, and the tuner restarts on route changes anyway. Its detector also rebuilds if the delivered rate ever changes (existing guard). |
| Output stream lost and the rebuild fails (Android `onStreamFail`) | Stops: "Audio output stopped (device changed). Tap play to retry." | `ctx.onerror` → stop, reason `error`. Here `state` can still read `running`, so start now always calls `ctx.resume()`, which restarts the driver. |
| Long background, or the OS paused the engine | Coming back to the foreground never shows "running" while silent. | On the background → foreground transition, check that `currentTime` advances at least 50 % of wall time over 300 ms and that `state === 'running'`. If not, stop with reason `stalled`. Start always re-activates the session and resumes the context. |
| App swiped away or killed while running | Sound and notification go away together. | `stopWithTask=true`: the lib's `CentralizedForegroundService` is destroyed with the task. No code needed; the config is already persisted. |
| Notification permission denied (Android 13+) | Background playback still works, with no visible notification. | We ask only while the permission is `Undetermined`. The FGS starts with the notification hidden. |
| Notification swiped away (Android 14+ allows it) | Keeps playing. | The lib only emits `playbackNotificationDismissed`; the FGS stays subscribed until `hide()`. We ignore the event. |
| Notification Pause button, or a headset play/pause key | Metronome stops (a plain stop, no message). | `enableControl('pause', true)`, then the events above → `remoteStop`. **Android ≤ 12:** the lib's `PlaybackNotificationReceiver` ignores the button's `MEDIA_BUTTON` broadcast (verified), so the button does nothing there. Android 13+ builds the media controls from the MediaSession, so it works. I used Pause rather than Stop because the lib shows Stop only when Pause is off, and Android 13+ media controls don't draw Stop. |
| Doze, battery saver | Keeps playing with the screen off. | A mediaPlayback FGS with audio playing is exempt from Doze, and the clicks are rendered natively. **Not under our control:** OEM task killers (Xiaomi, Huawei, Samsung "sleeping apps"). The workaround is to exempt TunePulse from battery optimisation (dontkillmyapp.com). |
| Native call failures | A readable `error`; no unhandled rejections. | Start is in try/catch and releases focus on failure. Background start failure gives "Background playback unavailable: …". Focus, listener and notification calls are wrapped, `stopBackgroundPlayback().catch`, and listener exceptions are isolated in the fan-out. |

### Known v1 limitation: no playing along with a backing track
Starting the metronome pauses Spotify and other media apps on Android, because we take AUDIOFOCUS_GAIN. iOS already did this, since the session doesn't use `mixWithOthers`. What it would take to change, checked in the lib:
- **Android:** `observeAudioInterruptions` also accepts `'gainTransientMayDuck'`. With it, other apps duck instead of pausing. Holding transient focus for a long time is not what that focus type is meant for, though.
- **Android alternative:** not calling it at all means no focus. Other apps keep playing, but we lose all call and alarm events. We would have to fall back to `AppState` and the stall check only.
- **iOS:** add `'mixWithOthers'` to the session options. It is a supported `IOSOption`. Changing the category or options while active rebuilds the graph, so it should be a setting applied while stopped.
- This could become a "Play along with other apps" setting that switches both platforms.

### Robustness section for the device checklist (for 15)
1. **Call:** with the metronome running, have someone call you. Clicks stop at the ring, the notification goes, and the screen says "Paused by a call…". After hanging up there is still no sound; tap play to resume the same groove.
2. **Alarm or timer:** set a 1-minute timer while the metronome runs. Same result as test 1.
3. **Other media:** with the metronome running, start Spotify or YouTube. The metronome stops with the interrupted message. Then do it the other way round: start Spotify first and press play on the metronome. Spotify pauses (expected v1 behaviour).
4. **Duck:** receive a message notification while the metronome runs. The metronome keeps playing and stays in time.
5. **Bluetooth off:** play through Bluetooth headphones, then turn the headphones off. The metronome stops ("headphones disconnected") and does **not** continue on the speaker. Repeat with wired headphones if you have any.
6. **Bluetooth on:** start on the speaker, then connect Bluetooth headphones. The clicks move to the headphones and keep the tempo; the BAR counter keeps counting.
7. **Tuner and route:** with the tuner running, connect and then disconnect Bluetooth headphones. The tuner restarts within about 1 s and still detects notes; there is no restart loop and no error.
8. **Tuner and call (iOS):** a call or Siri while tuning shows "Tuner paused" with Start again.
9. **Long background:** start the metronome, lock the phone for at least 10 minutes, then unlock. Either the clicks are still playing and the UI shows running, or it shows "Audio stopped in the background" with play available. Never "running" while silent.
10. **Swipe away:** close the app from recents while it plays. Sound and notification stop.
11. **Notification denied:** deny notification permission (Android 13+), start the metronome and lock the screen for 3 minutes. The clicks continue.
12. **Notification controls:** on Android 13+, Pause in the media controls (shade or lock screen) stops the metronome; a headset play/pause key does the same. Android ≤ 12: the button does nothing (known lib limitation).
13. **Notification swipe (Android 14+):** dismiss the notification while playing. Playback continues.
14. **Battery saver on**, screen off for 5 minutes: playback continues. On Xiaomi, Huawei or Samsung, note whether the system kills it; if it does, exempt the app from battery optimisation and retest.
15. **Notification icon:** the TunePulse icon (from 13's `ic_notification`) is shown in the status bar instead of the generic play icon. This needs a new build with 13's plugin.
