# TunePulse

Chromatic tuner + metronome for musicians. Mobile-first PWA, fully client-side, deployable for free on Vercel.

Part of the **BandPulse** ecosystem.

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4
- React Router
- `vite-plugin-pwa` (offline-first, installable)
- Web Audio API (`AudioWorklet` for low-latency pitch detection — coming in Phase 2)

## Scripts

```bash
npm run dev      # start dev server
npm run build    # production build
npm run preview  # preview production build
npm run lint     # eslint
```

## Roadmap

- **Phase 1** — Scaffolding, layout, theme system, audio engine stubs ✅
- **Phase 2** — MPM pitch detection in AudioWorklet, metronome lookahead scheduler
- **Phase 3** — Tuner UI (visualization with Claude Design)
- **Phase 4** — Metronome UI (BPM, time signatures, subdivisions, tap tempo, patterns, count-in, haptic)
- **Phase 5** — PWA polish, icons, install testing

## Architecture

```
src/
├── audio/        # AudioContext, pitch detector, metronome scheduler
├── components/   # TabBar, ThemeToggle
├── screens/      # Tuner, Metronome, Settings
├── hooks/        # useTheme
└── lib/          # notes.ts (frequency → note + cents)
```

## Notes

- Chromatic by default (no instrument presets in MVP)
- Reference A4 = 440 Hz (configurable later)
- In-tune tolerance: ±5 cents
- UI in English; note notation toggleable (C-D-E / Do-Re-Mi)
