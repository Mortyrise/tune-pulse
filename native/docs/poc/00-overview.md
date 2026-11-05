# TunePulse native — PoC overview

Goal: prove that an Expo (dev build) app can do the two risky things the PWA can't do well:

1. **Tuner** — read raw microphone PCM in real time, run McLeod (MPM) pitch detection, show note + cents with low latency.
2. **Metronome** — sample-accurate clicks that **keep playing with the screen locked / app in background** (iOS and Android).

UI is deliberately ugly: no design system, no router. Two tabs, plain `View`/`Text`. If the PoC passes on real devices, the full UI port comes later.

## Stack (already installed in `native/` — do NOT run npm install / expo install)

- Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6
- `react-native-audio-api` (Software Mansion) — Web Audio API–like: `AudioContext`, `OscillatorNode`, `GainNode`, `AudioRecorder`, `AudioManager` (session/permissions). **Verify the real API against the installed version in `node_modules/react-native-audio-api` (types + README) and its docs at https://docs.swmansion.com/react-native-audio-api/ — do not trust memory.**
- `expo-dev-client`, `expo-haptics`, `expo-keep-awake`
- `vitest` (dev) for pure-TS unit tests
- Expo docs: read `native/AGENTS.md` first (versioned docs, `llms.txt`).

If you believe you need another dependency, **stop and report it** instead of installing it — several agents share `package.json`.

## Source layout and ownership

Each task owns specific files. Do not edit files owned by another task; if you need a change there, write it in your doc under "Requests to other tasks".

| Path | Owner |
|---|---|
| `src/core/notes.ts`, `src/core/mpm.ts`, `src/core/*.test.ts` | 01-core |
| `src/audio/tuner.ts`, `src/hooks/useTuner.ts`, `src/screens/TunerScreen.tsx` | 02-tuner |
| `src/audio/metronome.ts`, `src/hooks/useMetronome.ts`, `src/screens/MetronomeScreen.tsx` | 03-metronome |
| `App.tsx`, `index.ts`, `app.json`, `eas.json`, `src/audio/session.ts`, `README.md`, `docs/poc/device-test-checklist.md` | 04-shell |

## Shared contracts (stubs already exist — implement, don't change signatures without flagging)

- `src/core/mpm.ts` → `class MpmDetector { constructor(sampleRate: number, opts?: Partial<MpmOptions>); push(samples: Float32Array): PitchSample | null; reset(): void }` — `push` appends to an internal ring buffer and returns a sample every `hopSize` samples (else `null`).
- `src/core/notes.ts` → same API as the web `src/lib/notes.ts` (`frequencyToNote`, `formatNoteName`, …).
- `src/audio/session.ts` → `getAudioContext(): AudioContext` (single shared context), `configureAudioSession(mode: 'tuner' | 'metronome'): Promise<void>`, `requestMicPermission(): Promise<boolean>`.

## Reference (web PWA, repo root)

- MPM: `src/audio/worklets/mpm-processor.js`
- Scheduler: `src/audio/metronomeScheduler.ts`
- Notes: `src/lib/notes.ts`, hook logic: `src/hooks/useTuner.ts`, `src/hooks/useMetronome.ts`

## Workflow per task

1. **Plan**: write your plan into your task doc under `## Plan` (files, API you verified, risks, how you'll verify). Don't write code yet. Stop and report.
2. Lead reviews; you get approval or changes.
3. **Implement** only your files. Run `npx tsc --noEmit` (and `npx vitest run` for core) from `native/`. Fill `## Result` in your doc (what was done, what couldn't be verified without a device).
4. Lead reviews against acceptance criteria.

No git commits, no branches — the lead commits.

## Environment limits

WSL, no Android SDK / Xcode / Java. We cannot build or run on a device here. Verification = typecheck, unit tests, `npx expo-doctor`, `npx expo config --type introspect`. Device testing is done by the user via EAS dev build, guided by `docs/poc/device-test-checklist.md`.
