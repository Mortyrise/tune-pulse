# TunePulse Roadmap

## Status — May 2026

Core engine and minimal UI shipped. App is usable end-to-end:
- Chromatic tuner with MPM pitch detection (AudioWorklet, 4096-sample window).
- Metronome with sample-accurate Chris Wilson scheduler.
- PWA installable, offline-first.

Visual polish is placeholder by design — final look comes from Claude Design once features are locked.

---

## ✅ Completed

### Phase 1 — Scaffolding
Vite + React + TS + Tailwind v4 + PWA, tab bar, theme system, audio engine stubs.

### Phase 2 — Audio engine
MPM pitch detection (NSDF + key-maximum picking + parabolic interpolation), useTuner hook with permission lifecycle, Chris Wilson metronome scheduler with synthesized clicks, useMetronome hook, functional Tuner & Metronome screens, sticky tuner display, threshold-zone cents meter.

---

## 🟡 Next phases — pick one

### Phase 3 — Settings + tuner refinements

**Scope**
- Settings screen wired to real config (currently it only shows the theme toggle).
- Toggles: note notation (C-D-E / Do-Re-Mi), accidental preference (♯/♭), reference pitch (A4 = 440 Hz, configurable in 1 Hz steps), in-tune tolerance (±3 / ±5 / ±10¢).
- Persist all settings to localStorage.
- Wire settings into TunerScreen (currently hardcoded).
- Optional: note history (last N detected notes, cleared on stop).

**Why** Settings are configurable in the data model but no UI exists. Small surface, immediate quality-of-life win.

**Effort** S
**Dependencies** None

---

### Phase 4 — Metronome feature complete

Split into sub-iterations that can land independently.

**4a — Tap tempo + count-in**
- Tap tempo button: derive BPM from time between taps (sliding window of 4 taps).
- Count-in: 1, 2, 3, 4 visual + audible click before the pattern starts (configurable: off / 1 bar / 2 bars).

**4b — Time signature + per-beat subdivisions**
- Numerator picker (1–12) and denominator picker (2 / 4 / 8 / 16).
- Per-beat subdivision editor: tap each beat dot to cycle quarter → eighths → triplets → sixteenths.
- Accent toggles per beat (long-press to set/unset accent).

**4c — Saved patterns + haptic**
- "Save pattern" dialog, list of saved patterns in Settings or a new Patterns screen.
- Haptic mode: `navigator.vibrate` instead of audio click (silent practice on phone).

**Why** Turns a basic metronome into something usable for serious practice (odd time signatures, complex subdivisions, setlist-style patterns).

**Effort** M total (S each sub-iteration)
**Dependencies** None — audio engine already supports it all.

---

### Phase 5 — Design system + brand

**Scope**
- Brief Claude Design with the locked feature set.
- Brand identity: logo, color palette, typography that fits the BandPulse ecosystem.
- Final visual design for Tuner and Metronome screens (with input from "minigame-like" exploration JM mentioned for the chromatic tuner).
- Real PWA icons (192 / 512 + maskable), Apple splash screens.
- Microinteractions (button press feedback, beat-aligned UI pulse on metronome, etc.).
- Onboarding (first-launch tooltip overlay or 2-screen intro).

**Why** Currently UI is functional but minimal placeholder. To feel like a real product.

**Effort** M/L
**Dependencies** Phases 3 & 4 should be feature-complete first, so the design covers everything.

---

### Phase 6 — Instrument modes (post-MVP)

**Scope**
- Mode picker: Chromatic (default), Guitar (standard / drop D / half-step), Bass (4 / 5 string), Ukulele, Violin.
- String-by-string indicator: highlight the expected pitch for the closest string, show whether you're sharp/flat relative to it.
- Per-instrument visualization (e.g., headstock-style view for guitar).

**Why** Differentiator from generic chromatic tuners; this was JM's "Fase 2 features" from the original spec.

**Effort** L
**Dependencies** Phase 3 settings infrastructure; Phase 5 design ideally.

---

### Phase 7 — Production-ready / pre-launch

**Scope**
- Accessibility audit: keyboard navigation, screen reader labels, focus order.
- Lighthouse perf optimization (bundle splitting if needed).
- Cross-device testing: iOS Safari, Android Chrome, desktop browsers.
- E2E smoke test (Playwright) for tuner permission flow + metronome start/stop.
- Optional: Sentry or similar for production error logging.
- SEO / Open Graph tags for sharing.

**Effort** M
**Dependencies** Everything else done.

---

## Suggested order

1. **Phase 4a** next — tap tempo + count-in. Highest user value per unit of work; tap tempo especially is something musicians use every session.
2. **Phase 3** — Settings UI. Quick QoL.
3. **Phase 4b**, then **4c**.
4. **Phase 5** — design pass once features are locked.
5. **Phase 6** (optional post-MVP).
6. **Phase 7** before public launch.

---

## Backlog / known issues

- Investigate the "+0.6¢ in orange" report (could not reproduce from code inspection; revisit with screenshot if it recurs).
- Replace placeholder `favicon.svg` with the real brand icon when design is ready.
