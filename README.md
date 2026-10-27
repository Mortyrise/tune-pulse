# TunePulse

Chromatic tuner + metronome for musicians. Mobile-first PWA, fully client-side, deployable for free on Vercel.

Part of the **BandPulse** ecosystem.

## Stack

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

Mobile app is feature-complete with the pulse·groove redesign (`handoff/`). Remaining work — desktop dashboard, PWA icons, pre-launch QA — is tracked in [ROADMAP.md](ROADMAP.md).

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
