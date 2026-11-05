# 10 — Tuner screen (pulse·groove)

Read `00-overview.md`, `../poc/07-tuner-ux.md`, `../poc/06-tuner-detection.md`.

## Scope
Rebuild `src/screens/TunerScreen.tsx` to match `handoff/README.md` → "Tuner screen", "Reference pitch sheet", "States", and the web `../../src/screens/TunerScreen.tsx` (layout, CentsRing, HistoryStrip, string targets, narrative, hold-to-confirm, in-tune badge bounce).
- Reuse the behaviour from `src/tuner-ui/display.ts` (`reduceView`) and `useTuner` — move/rename freely inside your ownership, keep tests green.
- Settings from `useTunerSettings()` (reference A4, tolerance, notation, accidental, instrument) — no local settings state any more; reference pitch via `BottomSheet`.
- Atoms from 09 (code against web props per `09-atoms.md` → Contract).
- States: idle (tap to start), listening, mic denied (open Settings), error. Tuner runs only while its tab is focused (`active` from 08's route) and stops on background.
- Keep the preset/debug info reachable but hidden (e.g. long-press the title or a small "debug" toggle) — we still need it for device testing.

## Acceptance
tsc / vitest / lint clean; visually matches the handoff on a ~390×844 phone in all 3 themes.

## Plan

**Layout** (running state, top → bottom, ~390×844 without scrolling; `ScrollView` kept only as overflow fallback). All styles from `useTheme()`; mono/display fonts from `fonts`.
1. **Top bar** — brand (08's `BrandMark` if it exists, else inline dot + `pulse·groove`) · right: section label = instrument name (`TUNER` in idle/error) + `Icon settings` → `router.push('/settings')`. **Long-press the label (600 ms) toggles the debug panel.**
2. **Meta row** (mono 10.5) — `Pressable` "A4 · **440 Hz** ›" opens the reference sheet; right: `clarity N%` + **InTuneBadge** (`✓ IN TUNE`, good bg, mounted when `view.confirmed`, Reanimated scale 0.6→1 over 280 ms with `Easing.bezier(.2,1.3,.4,1)`).
3. **`CentsRing`** atom — `cents={note?.cents ?? 0} active={running && note} noteLabel/accidental` from `splitNoteName(formatNoteName(idx, notation, accidental))`, `octave`, `size=min(290, width-48)`, `holdProgress={view.holdProgress}`.
4. **Readout row** — left cents (mono 28, tone colour) + `narrative()`; right Hz (mono 18) + `target … Hz`. Same copy as today/web.
5. **`HistoryStrip`** atom — `history={view.history}` (`{cents, midi}` is a superset of web `HistorySample`).
6. **Target card** (`tuner-ui/TargetCard.tsx`) — `pg-card` look; header "`{instrument} target`" + accent "change ›" → instrument sheet. Strings row = web `pg-string` (closest: paper bg + accent dot; tuned: good; delta `+3¢` / `−2st`), chromatic: "Any pitch · 12 notes" + detected note.
7. **Footer** — segmented notation toggle (`C – D – E` / `Do – Re – Mi`, selected = fg bg) + 48 px `Icon micOff` stop button.
8. **Sheets** — `BottomSheet` "Reference pitch" (web copy + `Chip` per `REFERENCE_A4_PRESETS`, select = update + close); `BottomSheet` "Instrument target" (rows: name, ✓ accent if selected, string names mono). One `sheet` state (`'reference' | 'instrument' | null`).

**States** (`tuner-ui/TunerStates.tsx`)
- **idle**: 130 px accent circle + looping ring (Reanimated, 1900 ms ease-out, scale/opacity like `pg-ring-expand`) + `Icon mic`; Fraunces 28 "Tap to listen"; hint built from settings (`Guitar · A4 = 442 Hz · in-tune within ±5¢`, not hard-coded like web). Disabled until `hydrated`.
- **starting**: same view, "Listening…", ring paused/press disabled.
- **running**: layout above (also while `starting` if a sticky note exists — web rule).
- **error**: micOff in paper circle (bad colour), title + body, "Try again" (fg pill). Native kinds are `denied | other`: denied → "Microphone blocked" / "Allow microphone access for TunePulse in system Settings, then try again." + extra **"Open Settings"** button (`Linking.openSettings()`); other → "Microphone error" / `error.message`. "Back" chip → `stop()` (idle).
- Copy/hint/delta strings come from pure helpers in `tuner-ui/format.ts` (testable).

**Reuse vs change**
- Reuse unchanged: `reduceView` (sticky 1.5 s, median-3+EMA, hold 1.5 s, history 12/800 ms, `confirmCount`), `narrative`, `formatCents`, `findClosestString`, `useTuner` API (queue + 33 ms fold, AppState stop, token supersede), keep-awake, one haptic per confirm, stop on `active=false`.
- Change: `display.ts` `TONE_COLORS` (hex) → `toneColor(tone, colors)` mapping to theme `good/warn/bad`. Delete `tuner-ui/components.tsx` (CentsBar/HoldBar/HistoryStrip/StringRow/ChipRow/COLORS) once nothing imports it; `DebugPanel` moves to `tuner-ui/DebugPanel.tsx` (preset chips via `Chip` + existing `debugText`). Drop the `tunerAudio as unknown` cast: 06 landed, import `TUNER_PRESETS` / `DEFAULT_TUNER_PRESET` and the stats types directly (cleanup in `useTuner` too).
- Props: `TunerScreen({ active = true }: { active?: boolean })` — no required props; 08's route passes `active` from `useIsFocused`.

**Settings wiring** — `const { settings, updateSettings, hydrated } = useTunerSettings()`; `viewConfig = { referenceA4, inTuneCents }` memoised from settings (reduceView already resets smoothing on A4 change); notation/accidental/instrument read from settings; notation toggle, A4 sheet and instrument sheet call `updateSettings`. No local settings state. Debug preset: `usePersistentState('tunepulse.tuner.preset', DEFAULT_TUNER_PRESET)` (restart if running, as today); debug open flag is in-memory.

**Build order (Metro stays green)** — leaf files first (`format.ts` + test, `TargetCard`, `TunerStates`, `DebugPanel`, `InTuneBadge`), each tsc-checked while unimported; then `TunerScreen.tsx` swapped in one Write; then delete `components.tsx` and the hex `TONE_COLORS`. If 09's atoms are not ready, wait (no placeholders under `components/atoms`).

**Tests (vitest)** — existing `display.test.ts` stays green (+ `toneColor` maps to theme keys for 3 modes). New `format.test.ts`: string delta label (`+3¢`, `−2st`, rounding, null note), idle hint from settings (chromatic vs instrument, A4, tolerance), error copy per kind (+ unknown → other), clarity percent. Screen/atoms are not unit-tested (RN render needs jest-expo); verified on device: idle → listening → note, A4 sheet changes reading, instrument sheet, badge bounce, denied → Open Settings, long-press debug, tab switch stops mic, 3 themes.

## Result

**Lead's answers applied:** `inTuneCents` is passed to `CentsRing` and `HistoryStrip`; the optional `active` prop is kept (08's route passes `useIsFocused`); 08's `BrandMark` is used; long-press debug, and the preset persists; instrument picker in a `BottomSheet`.

**Files**
- `src/screens/TunerScreen.tsx`: rewritten as planned.
  - Settings come only from `useTunerSettings()`. Notation, A4 and instrument call `updateSettings`.
  - The debug preset is stored with `usePersistentState('tunepulse:tuner-preset', 'full', validator)`.
  - Uses gesture-handler's `ScrollView` (`flexGrow`; the footer is pushed down with `marginTop: 'auto'`), with no top inset.
  - Both sheets are controlled (`onClose` → `setSheet(null)`) and are rendered in every state.
  - The ring size is `min(290, width − 48)`.
- `src/tuner-ui/TunerStates.tsx`:
  - `TunerTopBar`: `BrandMark`, the section label (a 600 ms long-press toggles debug) and the gear, which calls `router.push('/settings')`.
  - `TunerIdleView`: 130 px accent circle with a looping Reanimated ring (1900 ms); the ring stops while starting. Start is disabled until settings `hydrated`.
  - `TunerErrorView`: "Try again" in all cases; **"Open Settings"** (`Linking.openSettings()`) only for `denied`; "Back" chip → `stop()`.
- `src/tuner-ui/TargetCard.tsx`: web `InstrumentTargetCard`. String labels follow the notation and accidental settings.
- `src/tuner-ui/InTuneBadge.tsx`: pops in on mount (scale .5→1 plus fade, 280 ms, `bezier(.2,1.3,.4,1)`).
- `src/tuner-ui/DebugPanel.tsx`: preset `Chip`s (they restart a running tuner) plus the old stats text.
- `src/tuner-ui/format.ts` (+ `format.test.ts`, 7 tests): `noteParts`, `stringDeltaLabel`, `idleHint`, `clarityPercent`, `errorCopy`.
- `src/tuner-ui/display.ts`: the hex `TONE_COLORS` is replaced by `toneColor(tone, colors)`. `reduceView` is unchanged.
- `src/hooks/useTuner.ts`:
  - `TunerDebug` is now built from 06's real `TunerInfo` / `TunerStats` types (the optional-field casts are gone).
  - `start()` defaults to `DEFAULT_TUNER_PRESET`.
  - The unmount cleanup copies its refs (fixes the lint warning).
- **Deleted:** `src/tuner-ui/components.tsx` (old CentsBar, HoldBar, etc.; nothing imported it any more).
- `display.test.ts`: `Array<T>` → `T[]` (lint warning).

**Deviations from the web, all deliberate**
- The idle hint shows the real settings, not hard-coded defaults.
- The closest string uses `colors.bg` as its highlight. The web uses `paper`, which is the same colour as the card, so the highlight would be invisible.
- Badge and stop-icon text use `colors.bg` instead of `#fff`, so no colours are hard-coded.
- Cents shown are the smoothed value (phase 1 decision).
- Changing the preset while running briefly shows "Listening…" while the tuner restarts.

**Checks**
- `npx vitest run`: 11 files, 195/195 passing.
- `npx expo lint`: 0 errors, 0 warnings.
- `npx tsc --noEmit`: no errors in my files. The only errors are in **11's `src/screens/MetronomeScreen.tsx`** (5 errors: `uiActive`, `debug`, `setAccent`, `setHaptics`, argument count against the new `useMetronome`). I left them, as instructed.

**Check on the phone (new dev build, ~390×844, light/dark/mono)**
1. Idle: the ring pulses; the hint matches your settings; tap → "Listening…" → the running layout.
2. Running: everything fits without scrolling above the tab bar, with no double top padding.
3. In ring and history, the colours follow the tolerance (±3/5/10). The hold arc fills, then the badge pops in with one haptic.
4. A4 › opens the sheet; picking 442 makes a 442 Hz tone read A at 0¢. Swipe down, backdrop tap and Android back all close it, and it can be reopened.
5. "change ›" opens the instrument sheet. Guitar highlights the closest string with `+3¢` / `−2st`; the top-bar label shows the instrument.
6. The notation toggle persists after an app restart, and so do A4, instrument and preset.
7. The gear opens Settings; switching tab or backgrounding the app stops the mic.
8. Deny the mic permission: "Microphone blocked" → Open Settings opens the app's system settings → Try again works.
9. Long-press the top-bar label (600 ms) toggles DEBUG in every state. Preset chips restart the tuner and the choice survives a restart.
10. Fonts: Fraunces in the ring and the idle title, JetBrains Mono in the readouts.
