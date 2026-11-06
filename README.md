# TunePulse

Chromatic tuner + metronome for musicians, with the pulse·groove design (`handoff/`). Part of the **BandPulse** ecosystem.

There are two apps in this repo. Both share the same design and detection logic.

## Apps

| App | Path | Stack | Run | Status |
|---|---|---|---|---|
| **Native app** (Android / iOS), the main mobile app from now on | [`native/`](native/README.md) | Expo SDK 58, expo-router, `react-native-audio-api` (dev build, not Expo Go) | `cd native && npx expo start --dev-client --tunnel` | Phases 1 (PoC: native tuner + background metronome) and 2 (pulse·groove UI port) done and running on Android; phase 3 (Google Play internal testing, audio robustness) in progress |
| **Web PWA** | repo root | Vite + React + TypeScript, Web Audio | `npm run dev` | Mobile feature-complete, deployable as a static site (Vercel); desktop dashboard pending |

The native app has its own README with its architecture, the dev-client/tunnel workflow and the EAS builds: [`native/README.md`](native/README.md). Its `src/core` ports the web's `src/lib` (notes, instruments, grooves, tempo) and the MPM detector. Remaining work for both apps is in [ROADMAP.md](ROADMAP.md).

The rest of this README covers the **web PWA**.

## Web stack

- Vite + React + TypeScript
- Tailwind CSS v4
- React Router
- `vite-plugin-pwa` (offline-first, installable)
- `lucide-react` icons
- Web Audio API (`AudioWorklet` running McLeod pitch detection; lookahead scheduler for the metronome)

## Scripts

```bash
npm run dev      # start dev server
npm run build    # production build
npm run preview  # preview production build
npm run lint     # eslint
npm run generate-pwa-assets  # regenerate PWA icons from public/favicon.svg
```

## Status

The PWA's mobile layout is feature-complete with the pulse·groove redesign. Remaining work (desktop dashboard, install check on devices, pre-launch QA) is tracked in [ROADMAP.md](ROADMAP.md).

## Architecture

```
src/
├── audio/        # AudioContext, MPM worklet + pitch detector, metronome scheduler
├── components/   # TabBar, ThemeToggle
│   └── atoms/    # Dial, PulseRings, CentsRing, BeatColumn, HistoryStrip, Chip, BottomSheet…
├── screens/      # Tuner, Metronome, Settings
├── hooks/        # useMetronome (+ provider), useTuner, useTunerSettings (+ provider), useTheme…
└── lib/          # notes, instruments, grooves library, tempo names
```

## Notes

- Tuner: chromatic by default, plus guitar / bass / ukulele / violin string targets
- Reference A4 = 440 Hz by default (presets 415–444, 400–480 Hz range)
- In-tune tolerance: ±5 cents by default (±3 / ±5 / ±10 configurable)
- UI in English; note notation toggleable (C-D-E / Do-Re-Mi), ♯ or ♭
- Themes: light / dark / mono
- Metronome and tuner settings persist in `localStorage`; the metronome keeps playing while you switch tabs
