# 12 — Settings screen

Read `00-overview.md`.

## Scope
`src/screens/SettingsScreen.tsx` matching the web `../../src/screens/SettingsScreen.tsx` and the handoff styling: theme (light/dark/mono via `useTheme().setMode`), notation (C-D-E / Do-Re-Mi), ♯/♭, reference A4 (presets + fine ±1 Hz within 400–480), in-tune tolerance (3/5/10), default instrument, app version (expo-constants) and a short "about". Uses atoms (`Chip`, etc.) per `09-atoms.md` → Contract and `useTunerSettings()`.

## Acceptance
tsc / lint clean; every control persists across restart (via 08's providers).

## Plan
**File:** `src/screens/SettingsScreen.tsx` (default export, no props). Owns only this file; local helpers (`Section`, `Row`, `ChipGroup`, `A4Stepper`) stay inside it.

**Layout** (mirrors web `SettingsScreen`, mobile only): `ScrollView` on `colors.bg`, 24px gutters, safe-area top. Header = Fraunces (`fonts.display.regular`) "Settings". Each `Section` = mono 10px uppercase eyebrow (`colors.muted`, letter-spacing) + card (`colors.paper`, 0.5px `colors.border`, radius 14, hairline row dividers). `Row` = label (`sans.medium` 14, `fg`) + optional hint (`sans.regular` 12, `muted`), control below/right. Styles via `useMemo(() => makeStyles(colors, fonts))`; zero hard-coded colours/fonts.

**Atoms:** only `Chip` (`active`, `onPress`, children) — replaces the web `SegmentedControl` (handoff `.pg-chip`: 30px pill, active inverts fg/bg). `ChipGroup<T>` = row of Chips with `accessibilityRole="radiogroup"` / each `radio` + `accessibilityState.checked`. `Icon` (09) for `minus`, `plus`, `refreshCw`. If 09's Contract renames `onClick`→`onPress` differently, adapt here only.

**Sections & mapping** (all writes via `useTunerSettings().updateSettings(patch)`; persistence is 08's job):
1. *Appearance* — Theme: ChipGroup `Light | Dark | Mono` → `useTheme().setMode(mode)`, active = `mode` (explicit chips instead of web's cycling `ThemeToggle`: clearer on touch).
2. *Tuner*
   - Notation: `C-D-E | Do-Re-Mi` → `{ notation: 'english' | 'latin' }`.
   - Accidentals: `♯ Sharps | ♭ Flats` → `{ accidental }`.
   - Reference pitch: see A4 below.
   - In-tune tolerance: `TOLERANCE_OPTIONS` → `±3¢ ±5¢ ±10¢` → `{ inTuneCents }`.
   - Default instrument: Chips from `INSTRUMENTS` (`src/core/instruments.ts`, `name`) wrapping (`flexWrap`) → `{ instrument: id }`. Hint: "Tuner opens on this instrument".
   - Preview row: `formatNoteName(9, notation, accidental)` + muted "4" + `· {referenceA4} Hz` in mono.
3. *Reset* — outline pill "Reset tuner settings" (refreshCw) → `updateSettings(DEFAULT_TUNER_SETTINGS)` (contract has no `resetSettings`; theme is not reset, same as web).
4. *About* — app name + version + short blurb (see below).

**A4 fine control:** row hint "A4 = N Hz (standard 440)". Line 1: stepper `[-] N Hz [+]` (36px round outline buttons, mono 16 tabular value), ±1 Hz, clamped to `MIN_REFERENCE_A4..MAX_REFERENCE_A4` with a local `clamp` (round + min/max), buttons disabled (opacity .3) at the bounds. Press-and-hold auto-repeat (Pressable `onLongPress` → interval 80ms, cleared on `onPressOut`) — nice-to-have, kept small. Line 2: preset Chips from `REFERENCE_A4_PRESETS` (`415 … 444`), active when `referenceA4 === preset`; plus handoff copy "The frequency assigned to A above middle C…" as hint text. Updates go straight to `updateSettings` (no local draft), so the tuner re-renders live.

**Version / about:** `Constants.expoConfig?.version` (expo-constants, already a dependency) with fallback `'—'`; optionally append `Constants.expoConfig?.android?.versionCode` if set. Blurb: "TunePulse — chromatic tuner and metronome. pulse·groove design." Mono 11px muted.

**Hydration:** if `!hydrated`, render the same layout (defaults) but don't block; no flash-guard needed because writes only happen on user press.

**Checks:** `npx tsc --noEmit`, `npx expo lint`; manual: change each control, kill app, reopen → values kept.

## Result
**Done.** `src/screens/SettingsScreen.tsx` replaces 08's placeholder. It keeps the same default export and takes no props. It draws no header of its own; the native stack header provides the back button. On top of the approved plan:
- **Theme:** chips Light / Dark / Mono (`sun` / `moon` / `contrast` icons) → `setMode`. **There is no "System" option.** 08's `setMode(mode: ThemeMode)` cannot clear the stored choice back to `null`, so once the user picks a theme, nothing can return the app to following the system. Fixing it needs 08 to change the contract, e.g. `setMode(mode | null)` or `preference: ThemeMode | 'system'`. The internal `setStored` already accepts `null`.
- **Tuner:**
  - Notation, accidentals, tolerance and instrument are wrapping chip groups. The instrument hint reads "Also changeable in the tuner".
  - There is a preview row.
  - Reset calls `updateSettings(DEFAULT_TUNER_SETTINGS)`. The theme is not reset.
- **A4:** a ±1 Hz stepper. Holding a button repeats every 80 ms. Values are clamped with 08's `clampReferenceA4`, and each button is disabled at its bound. Below the stepper are preset chips (`REFERENCE_A4_PRESETS`) and the handoff copy.
- **About:** the version from `Constants.expoConfig?.version`, plus the Android versionCode if one is set, and a one-line description.
- **Diagnostics:** a collapsible section, closed by default. It samples when opened and has a Refresh button. Rows:
  - The tuner's last preset. It is read from `usePersistentState('tunepulse.tuner.preset')` (10's key), read-only.
  - `ENGINE_MODE`.
  - The output of `getEngineDiagnostics()`. The screen looks it up through a namespace import of `hooks/MetronomeProvider` or `audio/metronome`, whichever exports it, and calls it inside a try/catch. An object result is shown as key/value rows. If the function is missing, the row reads "diagnostics unavailable". 11 has not exported it yet, so that is what shows today.
- **Checks:** `tsc` is clean for this file. The remaining errors are in 10's in-progress files: `TunerScreen.tsx` and `tuner-ui/components.tsx` import `TONE_COLORS`, which was removed from `display`. `expo lint` reports 0 errors; its 2 warnings are in 10's `useTuner.ts` and `display.test.ts`. I have not tested on the device yet.
- **Note:** the Fraunces "Settings" title sits under the native header, which also says "Settings". If that looks redundant, either drop the in-page title or hide the header title.

**Follow-ups (round 2)**
- **Theme:** a "System" chip now comes first. The chip group is bound to `useTheme().preference`, and `setMode` accepts `'system'` (08's new API). The hint now reads "System follows the phone setting".
- **Diagnostics preset key:** fixed to 10's `tunepulse:tuner-preset`.
- **Engine diagnostics:** wired directly. The screen calls `useMetronome({ live: false }).getEngineDiagnostics()` (11's `EngineDiagnostics`: contextState, sampleRate, mode, backgroundPlayback, error), inside a try/catch. `live: false` stops the screen re-rendering on every beat. The namespace-import lookup and the separate `ENGINE_MODE` row are gone; the engine mode is the `mode` field.
- **Title:** the Fraunces title stays. 08 cleared the native header title, so it no longer appears twice.
- **Checks:** `npx tsc --noEmit` and `npx expo lint` both pass with no errors and no warnings across the whole project.
