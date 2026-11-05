# 02 — Tuner: mic capture → MPM → screen

Read `00-overview.md` first.

## Scope

- `src/audio/tuner.ts`: `startTuner(onSample: (s: PitchSample) => void): Promise<{ stop(): void }>`.
  - Uses `react-native-audio-api` to receive raw PCM buffers from the mic (e.g. `AudioRecorder` + `onAudioReady`, or whatever the installed version provides — verify). Mono, native sample rate; pass the actual sample rate to `MpmDetector`.
  - Uses `requestMicPermission()` and `configureAudioSession('tuner')` from `src/audio/session.ts` (owned by 04 — use the contract, don't implement it).
  - Feeds buffers to `MpmDetector` (from `src/core/mpm.ts`, owned by 01 — code against the contract; it may still be a stub while you work).
  - Decide and justify: run MPM on the JS thread vs. an audio-thread worklet (`react-native-worklets` is NOT installed — if you think it's needed, report it). Prefer JS thread for the PoC unless the API forces otherwise.
  - Clean stop: no leaked recorder, releases the mic.
- `src/hooks/useTuner.ts`: status `idle|starting|running|error` (`denied` / `other`), latest sample, start/stop. Throttle UI updates to ~30 fps.
- `src/screens/TunerScreen.tsx`: minimal UI — start/stop button, big note name (via `src/core/notes.ts`, A4=440), cents number with a simple horizontal bar (−50..+50), frequency, clarity, RMS, and a debug line: sample rate, buffer size, analyses/second. Green when |cents| ≤ 5. Use `expo-keep-awake` while running.
- Stop the tuner when the screen is hidden (the shell renders tabs by state; accept an `active: boolean` prop).

## Acceptance

- `npx tsc --noEmit` passes (once 01 lands).
- No web APIs (`navigator`, `window`, `AudioWorkletNode`).
- Doc `## Result` lists exactly what to look at on device.

## Plan

**Verified API** — `react-native-audio-api@1.0.0` (installed `node_modules/react-native-audio-api/package.json`; read `src/core/AudioRecorder.ts`, `src/types.ts`, `src/events/types.ts`, native `common/cpp/audioapi/core/utils/AudioRecorderCallback.cpp`). Matches docs.swmansion.com "AudioRecorder" page.
- `new AudioRecorder(options?: { androidInputPreset?, iosVoiceProcessing? })` — defaults (`voiceRecognition` / `false`) = raw mic, no AGC/NS: exactly what a tuner wants. Docs recommend a single instance.
- `recorder.onAudioReady({ sampleRate, bufferLength, channelCount }, cb: ({ buffer: AudioBuffer, numFrames, when }) => void): Result<void>`; `clearOnAudioReady()`.
- `recorder.onError(cb: ({ message }) => void)`; `clearOnError()`. Overflow → frames dropped + `onError`.
- `start(): Promise<Result<{}>>`, `stop(): Promise<Result<FileInfo>>`, `isRecording()`, `inputLatency` (s). `Result = {status:'success'} | {status:'error', message}` — start/stop do **not** throw.
- Native facts: callback buffer is resampled (r8brain) to the **requested** `sampleRate`, delivered in chunks of **exactly** `bufferLength` frames, a fresh `AudioBuffer` per event (no reuse → safe to read), dispatched to the **JS thread** via `CallInvoker`. No file output unless `enableFileOutput()` — we don't call it.

**Files**
- `src/audio/tuner.ts` — `startTuner(onSample, opts?) → Promise<TunerHandle>`; `TunerHandle = { stop(): void; info: { sampleRate, bufferSize } }` (superset of contract). Throws `TunerError { kind: 'denied' | 'other' }`.
- `src/hooks/useTuner.ts` — `{ status, error, sample, stats, start, stop }`.
- `src/screens/TunerScreen.tsx` — default export, prop `{ active: boolean }`.

**Flow in `startTuner`**
1. `requestMicPermission()` → false ⇒ throw `denied`. 2. `await configureAudioSession('tuner')`. 3. Lazy module-singleton `AudioRecorder()`. 4. `sampleRate = 48000` (requested; lib resamples, so this is the real rate of the data — also read `buffer.sampleRate` on first chunk and assert/rebuild detector if it differs). 5. `new MpmDetector(sampleRate, { hopSize: BUFFER })`. 6. `onError` + `onAudioReady({ sampleRate, bufferLength: BUFFER, channelCount: 1 }, e => { const s = detector.push(e.buffer.getChannelData(0)); if (s) onSample(s) })`. 7. `await recorder.start()`; on `status:'error'` clear callbacks and throw `other` with message. A `stopped` flag makes `stop()` during start safe (stop after start resolves).

**Buffer size / rate** — `BUFFER = 2048` frames @ 48 kHz (~43 ms, ~23 callbacks/s). MPM window stays 4096 (web default); since `push` yields ≤1 analysis per call, analyses/s = callbacks/s ≈ 23. Lower than web (94/s) but plenty for a 30 fps UI, and caps CPU.

**JS thread vs worklet** — JS thread. The lib's worklet paths need `react-native-worklets` (not installed) and add risk; the recorder already delivers on JS. Cost concern: MPM is O(N·tauMax) ≈ 4096×1600 ≈ 6.5 M MACs per analysis at 48 k; ×23/s ≈ 150 M/s on Hermes (no JIT) — **this is the main risk**. Mitigations, behind constants in `tuner.ts`: (a) measure ms/analysis and show it in the debug line; (b) if too slow on device, request `sampleRate: 24000` with `bufferSize: 2048` (same 85 ms window, tauMax 800 → ~4× cheaper; maxFreq 5000 < Nyquist) — one-line change; (c) bigger `BUFFER` (4096 → ~12/s). Backlog detection: compare `when` (capture time) with wall-clock since start; show "lag ms" in debug.

**Throttling (hook)** — tuner callback writes latest sample + counters into refs; a `setInterval(33 ms)` publishes to state only if changed. Stats: sampleRate, bufferSize, analyses/s (1 s window), ms/analysis, lag.

**Errors** — `denied` (permission false); `other` (session config throw, `start()` error result, runtime `onError` → hook stops tuner and sets `error/other` with message). The `onError` overflow case is logged but not fatal unless repeated (count shown in debug).

**Cleanup** — `stop()`: `clearOnAudioReady()`, `clearOnError()`, `void recorder.stop()` (ignore result, no file), `detector.reset()`, idempotent. Hook stops on unmount and when `active` → false (screen calls `stop` in an effect on `active`). No session deactivate (shared with metronome — 04 owns the session). Keep-awake: `activateKeepAwakeAsync('tuner')` / `deactivateKeepAwake('tuner')` in an effect on `status==='running'` (not `useKeepAwake`, which is unconditional).

**Screen** — Start/Stop button, note via `frequencyToNote(f, 440)` + `formatNoteName` (exact signatures from 01's port), cents number + bar (View width −50..+50, green if |c| ≤ 5), Hz, clarity, RMS, debug line. "—" when frequency 0.

**Requests to other tasks**
- 01: `push()` must accept any chunk length (2048 here) and allow `hopSize` override; please report ms/analysis for 4096 @ 48 k and 2048 @ 24 k.
- 04: `configureAudioSession('tuner')` must set an input-capable category (iOS `playAndRecord`) **and** activate the session (`AudioManager.setAudioSessionActivity(true)`), and must not break a running metronome; `requestMicPermission()` = `AudioManager.requestRecordingPermissions() === 'Granted'`. App config: mic permission text + Android `RECORD_AUDIO` via the lib's plugin.

**Verification here** — `npx tsc --noEmit`; grep for `navigator|window|AudioWorkletNode` = none. Device-only: accuracy, latency feel, ms/analysis, lag, mic released (iOS orange dot / Android mic indicator disappears on Stop and on tab switch).

## Result

**Lead's answers applied:** "full" preset = `AudioManager.getDevicePreferredSampleRate()` (fallback 48000), window 4096, buffer 2048; "light" preset = request 24 kHz (lib resamples), window 2048, buffer 1024. Both ≈ 21–23 analyses/s. Switching preset while running restarts the tuner. Recorder `onError` is only counted. `startTuner` returns `{ stop(), info, stats }`.

**Files**
- `src/audio/tuner.ts` — `startTuner(onSample, { preset? }) → Promise<TunerHandle>`; throws `TunerError { kind: 'denied' | 'other' }`. Single module-level `AudioRecorder` (default options = raw mic). Start and teardown go through a serial queue, so fast Start/Stop/preset taps can't overlap on the shared recorder. A new start first tears down any active session. `stop()` is idempotent: the callback ignores data right away, then the queued step runs `clearOnAudioReady`, `clearOnError`, `recorder.stop()`, plus `detector.reset()`. A `buffer.sampleRate` guard rebuilds the detector if the delivered rate ever differs from the requested one. Stats: callbacks, analyses, total ms in `push`, lag (wall clock minus capture `when` since the first callback), error count, last error.
- `src/hooks/useTuner.ts` — `{ status, error, sample, debug, start(preset), stop }`. The sample is published to state at ≤30 fps (33 ms interval, only when changed), debug stats at 1 Hz. A token makes a stale in-flight start stop its own handle. Stops on unmount. **Stops when `AppState` leaves `active` (`background` or `inactive`) and does not auto-restart**: the user taps Start again. Reason: iOS has `UIBackgroundModes: audio` + `playAndRecord`, so a running recorder would keep capturing in the background (orange dot, privacy/App Store issue). `inactive` also fires for Control Center / call banners; stopping there too is intended.
- `src/screens/TunerScreen.tsx` — default export `{ active }`. Has the preset chips, Start/Stop button, note (`frequencyToNote(f, 440)` + `formatNoteName`), cents number and −50..+50 bar (green when |c| ≤ 5), Hz, clarity, RMS, and the debug block (preset, sample rate used, device rate, buffer, window, analyses/s, ms/analysis, lag, rec errors, last error). It calls `stop()` when `active` turns false. Keep-awake via `activateKeepAwakeAsync('tuner')` / `deactivateKeepAwake('tuner')` while running.

**MPM speed:** task 05-mpm-fft is making `MpmDetector` much faster with the same API, so nothing changes on the tuner side. The ms/analysis figure in the debug line will show the gain.

**Checks run here**
- `npx tsc --noEmit`: no errors in 02 files. The remaining errors are in 03's files: `App.tsx(8,29)` can't find `MetronomeScreen`, and `src/audio/metronome.ts(128,26)` has a `Float32Array<ArrayBufferLike>` vs `Float32Array<ArrayBuffer>` mismatch.
- No `navigator` / `window` / `AudioWorkletNode` in the 02 files.
- Lint not run: there is no ESLint config or binary in `native/` (`npx expo lint` would install one).
- Not verifiable without a device: everything below.

**Device test list (dev build)**
1. First Start → OS mic permission prompt. Denying shows "Mic permission denied." (status error/denied). Granting starts the tuner.
2. Debug line, preset full: `sr` equals the device rate (usually 48000; some Androids 44100), `buf 2048 win 4096`, about 21–23 analyses/s. Write down **ms/analysis**: it must stay well under ~43 ms (the callback period), and ideally under ~15 ms, to leave the JS thread room for UI.
3. **lag** must stay roughly constant (not grow) over 1–2 minutes. Growing lag means the JS thread can't keep up, so use light. rec errors should stay at 0.
4. Switch to **light**: the tuner restarts, `sr 24000 buf 1024 win 2048`. Compare ms/analysis with full (expected about 4x lower) and whether accuracy is the same.
5. Accuracy in both presets against a tone generator / reference tuner: A4 440 Hz → A4 within ±1–2 ¢; low E 82.41 Hz → E2; high E 1318.5 Hz → E6; also a real guitar string. Turns green within ±5 ¢. Silence → "—".
6. Latency feel: pluck a string and the note should show up without noticeable delay (~100 ms is OK). The needle should be stable on a sustained note.
7. Stop: the mic indicator (iOS orange dot / Android green privacy chip) disappears within about 1 s. Same when switching to the Metronome tab while running.
8. Spam Start/Stop and the preset chips quickly: no crash, ends in a consistent state, no mic indicator after a final Stop.
9. The screen doesn't auto-lock while running, and locks normally after Stop.
10. Run the tuner while the metronome is playing (if the shell allows it): both keep working, and the metronome doesn't glitch when the tuner configures the session.
11. Bluetooth headset connected: does input come from the headset mic or the phone? Note any errors.
12. Start the tuner, then go to the home screen / lock the device: the mic indicator disappears within about 1 s. Back in the app, status is idle and nothing restarts on its own. Pulling down Control Center while running also stops it (expected).
