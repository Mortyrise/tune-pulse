# TunePulse Roadmap

## Status — October 2026

The mobile app is feature-complete and carries the final pulse·groove design (spec in `handoff/README.md`):
- Chromatic tuner with MPM pitch detection (AudioWorklet), cents ring, hold-to-confirm, 12-note history, reference pitch, tolerance, notation, instrument string targets.
- Metronome with sample-accurate scheduler: BPM dial, time signatures, per-beat accents and subdivisions, tap tempo, count-in, haptic mode, 12 curated grooves + user-saved patterns.
- Light / dark / mono themes. Settings and metronome config persist; the metronome keeps playing across tabs.

What is left: desktop dashboard, real PWA icons, pre-launch QA.

---

## ✅ Completed

| Phase | Scope |
|---|---|
| 1 — Scaffolding | Vite + React + TS + Tailwind v4 + PWA, tab bar, theme system |
| 2 — Audio engine | MPM pitch detection, metronome lookahead scheduler, useTuner / useMetronome |
| 3 — Settings | Notation, ♯/♭, A4 reference, in-tune tolerance, persisted |
| 4a/4b/4c — Metronome | Tap tempo, count-in, time signatures, subdivisions, accents, saved patterns, haptic |
| 5 — Design (mobile) | pulse·groove redesign: tokens, fonts, atoms, Tuner + Metronome screens, grooves library |
| 6 — Instruments (partial) | Guitar / bass / ukulele / violin standard tunings with closest-string highlight |
| Block 1 — Stabilise | Metronome provider above the router + persisted config, lint clean, docs refreshed |

---

## 🟡 Remaining

### Block 2 — Installable PWA · S (icons ✅, device check pending)
- ✅ Icons generated from `public/favicon.svg` via `npm run generate-pwa-assets` (`pwa-assets.config.ts`): 64/192/512, maskable 512, apple-touch 180, `favicon.ico`.
- ✅ Manifest `theme_color` / `background_color` set to the redesign light background.
- ⏳ Verify install on iOS Safari and Android Chrome.
- When the final logo exists: replace `public/favicon.svg` and rerun the script (update `ICON_BACKGROUND` too).

### Block 3 — Desktop dashboard (≥900px) · M
Per `handoff/README.md` → "Desktop layout":
- `useMediaQuery('(min-width: 900px)')` switching to a `DashboardScreen`.
- 3-column grid: grooves library with search · metronome + tuner panes (atoms at 460px) · session rail with stats.
- Global keyboard shortcuts (Space, +/−, T, M, U, ⌘K), ignored inside inputs.

### Block 4 — Polish · S
- Replace `window.prompt` in "Save current" with a bottom-sheet form.
- Accessibility pass: ARIA on Dial / CentsRing / BeatColumn, keyboard control of the dial, focus order.

### Block 5 — Quality & launch · M
- Vitest for pure logic (`lib/notes`, `lib/tempo`, config loading, MPM on synthetic sine waves).
- Playwright smoke test: metronome start/stop, tuner permission flow with mocked `getUserMedia`.
- Cross-device testing: iOS Safari, Android Chrome, desktop browsers.
- Open Graph / SEO tags; deploy to Vercel.
- Optional: production error logging (Sentry or similar).

### Post-MVP
- Alternate tunings: drop D, half-step down, 5-string bass.
- First-launch onboarding.

---

## Backlog / known issues

- Investigate the "+0.6¢ in orange" report (could not reproduce from code inspection; revisit with screenshot if it recurs).
- Replace placeholder `favicon.svg` (green, pre-redesign palette) with the real brand icon, then regenerate PWA assets.
