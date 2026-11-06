# TunePulse native

The TunePulse chromatic tuner and metronome as a native Android/iOS app: Expo SDK 58, expo-router, TypeScript. It is the main mobile app going forward. The web PWA at the repo root shares the pitch detector (`src/core`) with this app.

It is native because of two things the PWA can't do well:

1. **Tuner**: raw microphone PCM in real time → McLeod (MPM, FFT-accelerated) pitch detection → note and cents.
2. **Metronome**: sample-accurate clicks that keep playing with the screen locked or the app in the background (an Android foreground service, iOS background audio).

Audio uses [`react-native-audio-api`](https://docs.swmansion.com/react-native-audio-api/), which has native code. **Expo Go won't work**, so you need a development build (dev client).

## Architecture

```
src/
├── app/                 # expo-router routes
│   ├── _layout.tsx      # providers: GestureHandler > Theme > (splash held) TunerSettings > Metronome > Stack
│   ├── (tabs)/          # custom TabBar: index = Tuner, metronome = Metronome
│   └── settings.tsx     # Settings, pushed on the stack (native back header)
├── screens/             # TunerScreen, MetronomeScreen, SettingsScreen
├── tuner-ui/            # tuner states, target card, in-tune badge, view reducer (smoothing, hold-to-confirm, history), hidden DebugPanel
├── metronome-ui/        # play button, session strip, signature + grooves sheets, formatting
├── components/          # Icon, BrandMark, TabBar
│   └── atoms/           # Dial, PulseRings, CentsRing, BeatColumn, SubdivisionCluster, HistoryStrip, Chip, BottomSheet (react-native-svg + reanimated)
├── theme/               # light / dark / mono tokens, fonts (Fraunces, Inter, JetBrains Mono), ThemeProvider (system / persisted)
├── settings/            # tuner settings provider, sanitizing, AsyncStorage (in-memory fallback if the native module is missing)
├── audio/               # audio session + permissions, tuner (mic → detector), metronome engine (lookahead scheduler, layout, config)
├── hooks/               # useTuner, useMetronome + MetronomeProvider, useTapTempo, useSavedPatterns
└── core/                # pure TS, unit-tested: MPM + FFT, biquad lowpass, notes, instruments, grooves, tempo
```

- The metronome provider sits above the navigator, so playback continues across tabs and Settings.
- Persisted in AsyncStorage under `tunepulse:*`: theme, tuner settings, tuner detector preset, metronome config, saved grooves.
- Hidden debug panel: long-press the tuner's top-bar label (detector presets and live stats). Settings → About shows the version.
- `core/` mirrors the web logic (`../src/lib`, `../src/audio/worklets/mpm-processor.js`) so both apps behave the same.

## Scripts

```bash
npm test             # vitest run (core, audio layout/config, settings, UI helpers)
npm run lint         # expo lint
npm run typecheck    # tsc --noEmit
npx expo-doctor      # dependency / config checks
```

## Prerequisites

- An Expo account: `npx eas-cli@latest login`. The project is already linked (`extra.eas.projectId` in `app.json`).
- Android: a phone with "Install unknown apps" allowed (browser or file manager), or USB debugging for `adb`.
- iOS: a paid Apple Developer account and `npx eas-cli@latest device:create` to register the device. iOS has not been built yet.

## Dev client

Build and install the dev client. You only need to rebuild when native config changes: `app.json` plugins or permissions, or a new native dependency. JS changes only need the dev server.

```bash
npx eas-cli@latest build --profile development --platform android
```

Open the build page on the phone and install the APK. **If the download fails on the phone**, download the APK on the computer and install it over USB:

```bash
adb install -r path/to/build.apk
```

## Run (dev server)

The setup that works from WSL2 (phone and PC can't see each other on the LAN) is the tunnel. It uses the `@expo/ngrok` dev dependency:

```bash
npx expo start --dev-client --tunnel
```

Open the TunePulse dev client on the phone and scan the QR code. If scanning doesn't open it, open this link on the phone instead, using the tunnel URL that Expo prints:

```
exp+tunepulse://expo-development-client/?url=<url-encoded tunnel URL>
```

On the same Wi-Fi without WSL, `npx expo start --dev-client` (no tunnel) is enough.

## Other builds

- `preview`: a standalone internal Android `.apk` with no dev server. Use it for lock-screen and background tests: `npx eas-cli@latest build --profile preview --platform android`.
- `production`: Play Store build (remote version, auto-increment). The release process (signing, Play Console internal testing, listing, privacy policy) is in [`docs/store/release-runbook.md`](docs/store/release-runbook.md).

## Device tests

Follow [`docs/device-test-checklist.md`](docs/device-test-checklist.md) and fill in pass/fail per device and build.

## Docs

- `docs/poc/`: phase 1 (native tuner and background metronome proof of concept) task docs and results.
- `docs/phase2/`: phase 2 (pulse·groove UI port) task docs.
- `docs/phase3/`: phase 3 (release readiness) task docs.
- `AGENTS.md`: rules for coding agents (use versioned Expo docs, `npx expo install`).

## Troubleshooting

- **Tuner shows "microphone denied"**: use the button to open system Settings and allow the microphone (iOS asks only once).
- **Android: the metronome stops in the background**: allow notifications for TunePulse (the foreground service needs its notification), and set battery usage to "Unrestricted" on aggressive OEMs (Xiaomi, Samsung, Huawei).
- **Settings don't persist / `[storage] AsyncStorage unavailable` warning**: the installed dev client is older than the JS. Rebuild it.
- **App crashes on start after pulling new native deps**: same cause. Rebuild the dev client.
- **`No development build installed` / it opened in Expo Go**: use the TunePulse dev client.
- **Changes to `app.json` not applied**: they need a new EAS build.
- **Bluetooth headphones**: output goes over A2DP (stereo). The tuner uses the phone's built-in mic, not the headset mic, by design.
- Diagnostics: `npx expo-doctor`, `npx expo config --type introspect`.
