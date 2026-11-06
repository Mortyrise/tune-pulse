# TunePulse Roadmap

## Status — November 2026

TunePulse ships as two apps (see [README](README.md)):
- **Native app** (`native/`, Expo SDK 58): the main mobile app from now on. Phase 1 (PoC) and phase 2 (pulse·groove UI port) are done and running on Android. Phase 3 (release readiness) is in progress.
- **Web PWA** (repo root): mobile feature-complete, deployed on Vercel (auto-deploy from main). The plan below covers both apps.

The web mobile app is feature-complete and carries the final pulse·groove design (spec in `handoff/README.md`):
- Chromatic tuner with MPM pitch detection (AudioWorklet), cents ring, hold-to-confirm, 12-note history, reference pitch, tolerance, notation, instrument string targets.
- Metronome with sample-accurate scheduler: BPM dial, time signatures, per-beat accents and subdivisions, tap tempo, count-in, haptic mode, 12 curated grooves + user-saved patterns.
- Light / dark / mono themes. Settings and metronome config persist; the metronome keeps playing across tabs.

What is left: native Play Store release (phase 3), desktop dashboard (web only), pre-launch QA.

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
| Native 1 — PoC (`native/docs/poc`) | Expo dev build; native mic → MPM tuner (FFT NSDF, lowpass, ported from the worklet); sample-accurate metronome that keeps playing locked / in background (Android foreground service, iOS background audio); Vitest for `src/core` |
| Native 2 — UI port (`native/docs/phase2`) | pulse·groove on native: expo-router tabs + Settings, theme tokens and fonts, SVG/reanimated atoms, full Tuner, Metronome (grooves, saved patterns, count-in, haptic) and Settings screens, AsyncStorage persistence |

---

## 🟡 Remaining

### Native phase 3 — Release readiness (`native/docs/phase3`) · in progress
- Android release: app icon / splash, versioning, EAS production build, Play Console internal testing, store listing, privacy policy, data-safety answers. Runbook: `native/docs/store/release-runbook.md`.
- Audio robustness: interruptions (calls, other audio), route changes, engine recovery; adds a section to `native/docs/device-test-checklist.md`.
- Web detection parity: bring the native detector fixes (high notes read an octave low, 5 kHz lowpass, lower RMS gate, FFT NSDF) back to the PWA worklet.
- Cleanup and docs (READMEs, full-app device checklist).

### Block 2 — Installable PWA · S (icons ✅, device check pending)
- ✅ Icons generated from `public/favicon.svg` via `npm run generate-pwa-assets` (`pwa-assets.config.ts`): 64/192/512, maskable 512, apple-touch 180, `favicon.ico`.
- ✅ Manifest `theme_color` / `background_color` set to the redesign light background.
- ⏳ Verify install on iOS Safari and Android Chrome.
- When the final logo exists: replace `public/favicon.svg` and rerun the script (update `ICON_BACKGROUND` too).

### Block 3 — Desktop dashboard (≥900px) · M — web only
The native app is a portrait phone app; this block applies to the PWA only.
Per `handoff/README.md` → "Desktop layout":
- `useMediaQuery('(min-width: 900px)')` switching to a `DashboardScreen`.
- 3-column grid: grooves library with search · metronome + tuner panes (atoms at 460px) · session rail with stats.
- Global keyboard shortcuts (Space, +/−, T, M, U, ⌘K), ignored inside inputs.

### Block 4 — Polish · S
- Replace `window.prompt` in "Save current" with a bottom-sheet form.
- Accessibility pass: ARIA on Dial / CentsRing / BeatColumn, keyboard control of the dial, focus order.

### Block 5 — Quality & launch · M
- Web: Vitest for pure logic (`lib/notes`, `lib/tempo`, config loading, MPM on synthetic sine waves). The native app already has this in `native/src/core` (`npm test` in `native/`).
- Playwright smoke test: metronome start/stop, tuner permission flow with mocked `getUserMedia`.
- Cross-device testing: iOS Safari, Android Chrome, desktop browsers.
- Open Graph / SEO tags; deploy to Vercel.
- Optional: production error logging (Sentry or similar).

### Post-MVP
- Native: promote from internal testing to a public Play release; iOS build and TestFlight (needs an Apple Developer account).
- Alternate tunings: drop D, half-step down, 5-string bass.
- First-launch onboarding.

---

## Backlog / known issues

- Investigate the "+0.6¢ in orange" report (could not reproduce from code inspection; revisit with screenshot if it recurs).
- Replace placeholder `favicon.svg` (green, pre-redesign palette) with the real brand icon, then regenerate PWA assets.
