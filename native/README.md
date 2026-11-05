# TunePulse native (PoC)

Expo (SDK 58) dev-build proof of concept for the two things the TunePulse PWA can't do well:

1. **Tuner**: raw microphone PCM in real time -> McLeod (MPM) pitch detection -> note + cents.
2. **Metronome**: sample-accurate clicks that keep playing with the screen locked or the app in the background.

The UI is deliberately plain (two tabs). Audio uses [`react-native-audio-api`](https://docs.swmansion.com/react-native-audio-api/), which has native code, so **Expo Go won't work**: you need a development build.

## Prerequisites

- An Expo account: `npx eas-cli@latest login`
- iOS: an Apple Developer account (paid) to install on a real device.
- Android: any device with "Install unknown apps" allowed for your browser.

## First-time setup

```bash
cd native
npx eas-cli@latest init                 # links the project, adds extra.eas.projectId to app.json
npx eas-cli@latest device:create        # iOS only: register your iPhone's UDID (open the link on the phone)
```

## Build and install the dev client

```bash
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
```

When the build finishes, open the build page link (or scan the QR code) on the device and install it.
iOS 16+: enable **Settings > Privacy & Security > Developer Mode** the first time.

Rebuild only when native config changes (`app.json` plugins/permissions, new native dependency). JS changes just need the dev server.

## Run

```bash
npx expo start --dev-client             # phone and computer on the same Wi-Fi
npx expo start --dev-client --tunnel    # if they can't see each other (e.g. WSL)
```

Open the TunePulse dev client on the phone and pick the server (or scan the QR code).

## Other profiles

- `preview`: standalone internal build, Android as an installable `.apk`: `npx eas-cli@latest build --profile preview --platform android`. Use it for background/lock tests without the dev server attached.
- `production`: store builds (not needed for the PoC).

## Device tests

Follow [`docs/poc/device-test-checklist.md`](docs/poc/device-test-checklist.md) and fill in pass/fail.

## Troubleshooting

- **Tuner shows "microphone denied"**: iOS asks only once. Enable it in Settings > TunePulse > Microphone (the app has a button to open Settings).
- **No sound on iPhone**: check volume. The session is `playAndRecord` with `defaultToSpeaker`, so the silent switch shouldn't mute it, but low media volume will.
- **Clicks come from the earpiece / are very quiet**: report it, as it means the audio session wasn't configured before playback started.
- **Bluetooth headphones**: output goes over A2DP (stereo). The tuner uses the phone's built-in mic, not the headset mic, by design.
- **Android: metronome stops in the background**: allow notifications for TunePulse (the foreground service needs its notification), and set battery usage to "Unrestricted" on aggressive OEMs (Xiaomi, Samsung, Huawei).
- **`No development build installed` / app crashes on start in Expo Go**: you opened it in Expo Go; use the dev client.
- **Changes to `app.json` not applied**: they need a new EAS build.
- Diagnostics: `npx expo-doctor`, `npx expo config --type introspect`.
