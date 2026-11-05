# 11 — Metronome screen (pulse·groove) + full metronome features

Read `00-overview.md`, `../poc/03-metronome.md`.

## Scope
- **Engine parity** (`src/audio/metronome*.ts`): extend the looped-bar engine to the web feature set — per-beat accents, per-beat subdivisions, numerator 1–12, denominator 2/4/8/16, count-in bars (0/1/2 — e.g. render count-in bars as a separate one-shot segment before the loop), haptic mode (silent clicks + haptics while foregrounded). Keep the background-safe design and the beat-boundary handover; extend the vitest tests.
- **State**: `src/hooks/MetronomeProvider.tsx` + `useMetronome.ts` with the web API (`config, isRunning, activeBeat, toggle, setBpm, setCountInBars, setNumerator, setDenominator, toggleAccent, setSubdivision, setHapticMode, applyConfig`), config persisted via `usePersistentState`. Provider is mounted by 08 above the navigator so it keeps playing across tabs.
- `useTapTempo`, `useSavedPatterns` (AsyncStorage), `src/core/grooves.ts` (curated library from the web `src/lib/grooves.ts`), `src/core/tempo.ts`.
- **Screen**: `src/screens/MetronomeScreen.tsx` per `handoff/README.md` → "Metronome screen" + "Saved Grooves", and the web `../../src/screens/MetronomeScreen.tsx`: Dial (BPM), PulseRings synced to beats, BeatColumns (tap accent / cycle subdivision), time signature, tap tempo chip, count-in, haptic toggle, grooves library + saved patterns in a BottomSheet. Brand dot synced to the beat if 08 provides it.
- Beat UI events come from the engine's foreground poll; animations on the UI thread.

## Acceptance
tsc / vitest / lint clean; engine tests cover count-in, per-beat subdivisions, denominator; background playback design unchanged (state it).

## Plan

### Engine (`src/audio/metronomeLayout.ts`, `metronome.ts`, new `metronomeConfig.ts`)
- **Background design unchanged.** `start()` still schedules everything on the audio clock: an optional count-in source, then the looped bar. After that, JS is only needed for config changes and the foreground UI poll.
- **Count-in.**
  - `buildBarLayout(cfg, sr, { countIn: true })` gives one bar with one `COUNT_IN_CLICK` per beat (1200 Hz, no subdivisions, no accents; ported from the web). It uses the same `lengthSamples` as the pattern bar.
  - `start()` makes the count-in source (`loop = true`) with `start(t0)` and `stop(t1)`, where `t1 = t0 + bars * duration`. The pattern source gets `start(t1)`. Both are scheduled in the same JS tick, so the joint is sample-exact.
  - `Segment` gets `phase: 'count-in' | 'pattern'` and `barOffset`. Pattern `barIndex` keeps counting after the count-in bars, as on the web, where the screen subtracts `countInBars`.
  - A config change during the count-in goes through the existing path: base = last segment = pending pattern, earliest = `max(now + lead, base.startsAt)`. That swaps the pattern source at `t1` (`planHandover`, case "not started yet"). The count-in itself keeps its tempo (at most 2 bars).
  - `countInBars` changes mid-run apply on the next start (web parity). It is not part of `layoutKey`.
- **Per-beat subdivisions and accents.** `buildBarLayout` already reads `subdivisions[b]` and `accents`. The hook stops forcing one value onto every beat. I'll add tests for mixed `[1,2,3,4]`.
- **Numerator 1–12** (web `MIN/MAX_NUMERATOR`). Numerator 1 is already handled (`beatTimes = [0]`). I'll add tests for 1 and 12.
- **Denominator:** same meaning as the web.
  - It is notation only: BPM counts denominator-notes per minute (Bulería is 220 BPM in 12/8, one click per eighth). The layout ignores it, and it stays out of `layoutKey`, so changing it does not rebuild the buffer.
  - A test asserts that 4/4 and 4/8 give the same layout.
- **Haptic mode.**
  - Web behaviour: silent clicks plus a vibration on every step. Native: `engine.setMuted(bool)` ramps the output `GainNode` to 0 or 1 at `now + lead` (a 5 ms ramp, no pop). The loop keeps running, so timing, handover and the foreground service are untouched, and there is no rebuild. `hapticMode` stays out of `layoutKey`.
  - Haptics are fired by the provider from the foreground poll: accent → `impactAsync(Heavy)`, downbeat → `Medium`, subdivision → `Light`.
  - In the background haptic mode is silent, because nothing polls (see open question 1).
- **`metronomeConfig.ts`** (pure): `sanitizeConfig(unknown): MetronomeConfig` (port of the web `loadConfig` validation), `fitArrayLength`, `clampBpm`, `MIN/MAX_BPM`, `MIN/MAX_NUMERATOR`, `DENOMINATOR_OPTIONS`, `SUBDIVISION_OPTIONS`. `stepToEvent` gets `phase` and `barOffset` parameters.

### Provider and hook (`src/hooks/MetronomeProvider.tsx`, `useMetronome.ts`)
- **Provider** owns one `MetronomeEngine`.
  - Config comes from `usePersistentState('tunepulse:metronome-config', DEFAULT)` and is sanitized on read. The setter takes a value, not an updater, so actions compute the next config from a `configRef`.
  - It also handles: start/stop with session + `startBackgroundPlayback` (as in the PoC), and `AppState`, which gates `engine.setUiActive(appActive && isRunning)`. Polling now runs in the foreground on every tab, because haptics need it.
  - **The provider does not keep `activeBeat` in React state** (that would re-render the whole tree about 16×/s). It exposes `subscribeBeat(listener) → unsubscribe` instead, and fires haptics through it.
- **Context value**, memoized, changes only on config or run state: `config, isRunning, startedAt, hydrated, toggle, start, stop, setBpm, setCountInBars, setNumerator, setDenominator, toggleAccent, setSubdivision(beatIndex, sub), setHapticMode, applyConfig, subscribeBeat`.
- **`useMetronome({ live = true })`** = context + `activeBeat`. `activeBeat` is local state fed by `subscribeBeat`, only while `live` (the screen passes `useIsFocused()` from expo-router) and the app is active. The return shape is the web API. Calling it outside the provider throws, as on the web.
- **Persistence:** if start is pressed before `hydrated`, the hydrated config arrives later through `setConfig`, which is a normal handover. No special case.
- The PoC debug line leaves the screen. **Diagnostics for 12:** `useMetronome().getEngineDiagnostics(): EngineDiagnostics` (exported type from `src/hooks/useMetronome.ts`) = `{ contextState: string; sampleRate: number; mode: string; backgroundPlayback: boolean; error: string | null }`. It is a read-only snapshot taken at call time (works from any screen under the provider, also when the metronome has never started: `contextState: 'not created'`).

### Grooves, tempo, tap, saved patterns
- **`src/core/grooves.ts`:** `GROOVES_LIBRARY`, a verbatim copy of the web one (12 presets), plus a pure `grooveToConfig(groove, base)` that keeps `countInBars` and `hapticMode`.
- **`src/core/tempo.ts`:**
  - `getTempoCharacter`, ported from the web.
  - A pure `tapTempoBpm(taps: number[]): number | null`: window of 4 taps, reset after 2 s, mean interval.
  - `useTapTempo({ onBpm })` wraps it with `performance.now()`.
- **`useSavedPatterns`:** `usePersistentState('tunepulse:metronome-patterns', [])`, each entry sanitized (bad entries dropped). API: `patterns, save, remove, rename`.

### Screen (`src/screens/MetronomeScreen.tsx` + `src/metronome-ui/*`)
- **Structure:** default export, no props. A `ScrollView` (24 px padding, 16 px gaps) with the Play button pinned under it. Every style comes from `useTheme()`.
- **Top bar:** `pulse·groove` brand (the brand dot comes from 08's BrandMark, open question 2), a `METRONOME` label, and a gear icon → `router.push('/settings')`.
- **`TempoHeader`:** italic display font, 22 px, plus a mono 10 px meaning.
- **Hero (268 px):**
  - `PulseRings` (`tickId = activeBeat?.time`, `isAccent`, `size = 244`) under the `Dial` (`value = bpm`, 30–300, `onChange = setBpm`, `size = 260`, `isRunning`).
  - Dial children: BPM number (display light, 86 px, tabular), `BPM · DRAG` caption, and a signature pill `4/4 ♩` → signature sheet.
- **Bar pattern card:**
  - A horizontal `ScrollView` of `BeatColumn` (`beat, isAccent, subdivision, currentBeat, currentSub, isRunning, inCountIn, onToggleAccent, onCycleSubdivision`), with the web cycle 1→2→3→4→1.
- **`SessionStrip`:**
  - Left: `BAR 012 · 00:32`. The bar comes from `activeBeat.barIndex - countInBars`. Elapsed time comes from `startedAt` via a 250 ms interval, only while focused.
  - Right: `● live` / `● count-in` (warn colour) / `○ idle`.
- **Chips row** (`Chip`):
  - Tap tempo (`Hand`)
  - Count-in · off / 1 bar / 2 bars
  - Audio / Haptic (`Volume2` / `Vibrate`)
  - Grooves (`Bookmark`)
- **`PlayButton`:** 58 px, accent fill, `START GROOVE`; becomes an outlined `STOP` while running. Press scale 0.985.
- **`SignatureSheet`** (`BottomSheet`): numerator chips `[2…9, 12]` and denominator chips 2/4/8/16 with note glyphs.
- **`GroovesSheet`** (`BottomSheet`):
  - Read-only Library list (name, hint, `bpm · n/d`).
  - "My grooves": apply, delete (`X`), and "Save current" (`BookmarkPlus`). RN has no `window.prompt`, so "Save current" opens an inline `TextInput` row (`SaveGrooveRow`), prefilled with `"{bpm} bpm · n/d"`.
  - A "Current: …" footer.
- **Icons needed from 09:** Hand, Play, Pause, Bookmark, BookmarkPlus, Vibrate, Volume2, X, Settings.
- **Animations** stay inside the atoms (UI thread). The screen only passes `tickId` and current beat props, and those re-render only while the screen is focused.

### Tests (vitest, node)
- `metronome.test.ts`, additions:
  - Count-in layout: N clicks with the count-in style, same length as the pattern bar.
  - Mixed subdivisions: positions and styles.
  - Numerator 1 and 12.
  - Denominator has no effect on the layout.
  - `stepToEvent` phase and bar offset.
  - Handover into a pending pattern during the count-in.
- New `metronomeEngine.test.ts` with a fake `AudioContext` (the engine only imports types from the lib):
  - `start` with count-in schedules count-in `start(t0)`/`stop(t1)` and pattern `start(t1)`.
  - `stop` during the count-in stops both.
  - `setMuted` and a denominator change do not create a new source.
  - The poll emits the count-in phase, then the pattern phase.
- `metronomeConfig.test.ts`: `sanitizeConfig` fixes garbage, out-of-range values and length mismatches.
- `core/grooves.test.ts`: every preset is valid (subdivisions length = n, accents within 1..n), and `grooveToConfig` keeps count-in and haptic.
- `core/tempo.test.ts`: tempo character boundaries; tap-tempo mean, window and reset.

## Result

Implemented after lead approval. `npx tsc --noEmit` is clean, `npx vitest run` passes (17 files / 238 tests), and `npx expo lint` reports 0 problems. No failures in 10/12 files.

### Lead answers applied
1. Haptic mode in the background is silent (known limitation, below).
2. `BrandMark pulseMs={brandPulseMs(bpm, isRunning)}` = 2 beats while running, 2 s idle.
3. The PoC debug line is gone. The diagnostics API is `useMetronome().getEngineDiagnostics(): EngineDiagnostics`, where `EngineDiagnostics` is exported from `src/hooks/useMetronome.ts`:
   - Fields: `{ contextState, sampleRate, mode, backgroundPlayback, error }`.
   - It is a stable callback: call it on render or on a refresh press. It returns a snapshot, not reactive state.
4. Pulse rings fire on every step (`tickId = activeBeat.time`).
5. `usePersistentState` is used with updater + validate.
6. Count-in tempo behaviour accepted.

### Files
- **`src/audio/metronomeLayout.ts`** adds:
  - `COUNT_IN_CLICK`.
  - `buildBarLayout(cfg, sr, { countIn })`.
  - `stepToEvent(..., phase, barOffset)`.
  - `handoverBarOffset()`: keeps the run-wide bar number across handovers. The PoC reset it on every config change.
- **`src/audio/metronomeConfig.ts`** (new, pure): BPM / numerator limits (1–12), `DENOMINATOR_OPTIONS`, `SUBDIVISION_OPTIONS`, `COUNT_IN_OPTIONS`, `clampBpm`, `clampNumerator`, `fitArrayLength`, `nextSubdivision`, `sanitizeConfig`.
- **`src/audio/metronome.ts`**:
  - `Segment` gains `phase` and `barOffset`.
  - Count-in source in `start()`.
  - `setMuted()` and an exported `layoutKey`.
  - Re-exports the config module.
- **`src/hooks/useMetronome.ts`**:
  - `useMetronomeController()` (provider logic) and `MetronomeContext`.
  - `useMetronome({ live })` returns the web API plus `activeBeat`, `startedAt`, `runCountInBars`, `hydrated`, `error`, `start`, `stop`, `subscribeBeat`, `getEngineDiagnostics`.
  - The config is persisted at `tunepulse:metronome-config`.
- **`src/hooks/MetronomeProvider.tsx`** replaces 08's placeholder with the same export.
- **Other hooks:**
  - `src/hooks/useTapTempo.ts`.
  - `src/hooks/useSavedPatterns.ts`: `tunepulse:metronome-patterns`, `sanitizePatterns`; API `patterns, hydrated, save, remove, rename`.
- **Core:**
  - `src/core/grooves.ts`: verbatim library + `grooveToConfig`.
  - `src/core/tempo.ts`: `getTempoCharacter` + pure `registerTap`.
- **`src/metronome-ui/`**:
  - `format.ts` (pure).
  - `SectionLabel`, `SessionStrip`, `PlayButton`.
  - `SignatureSheet` (`SignatureSheetContent`), `GroovesSheet` (`GroovesSheetContent`).
- **`src/screens/MetronomeScreen.tsx`**:
  - Default export. Optional `active` prop, which 08's route passes from `useIsFocused()`.
  - Layout: gesture-handler `ScrollView`, Play button pinned under it, both sheets controlled. `onClose` always sets the sheet to null.
- **Tests:**
  - `metronome.test.ts` (+8 tests).
  - New `metronomeEngine.test.ts` (fake AudioContext, 7 tests).
  - New `metronomeConfig.test.ts`, `core/grooves.test.ts`, `core/tempo.test.ts`, `metronome-ui/format.test.ts`, `hooks/useSavedPatterns.test.ts`.

### Engine behaviour
- **Background playback design: unchanged.** `start()` schedules everything on the audio clock in one JS tick:
  - Without count-in, there is one looped bar source. JS is needed only for config changes and the foreground UI poll. Throttled or frozen timers cannot drop clicks.
  - With count-in, the count-in bar is a looped source: `start(t0)`, `stop(t1)`, where `t1 = t0 + bars × bar`. The pattern loop gets `start(t1)`. The joint is on the audio clock, sample-exact.
  - The session, the Android foreground service (`startBackgroundPlayback`) and the beat-boundary handover are as in the PoC.
- **Config change during the count-in:** the pending pattern is swapped at `t1` by the existing handover path. The count-in keeps its tempo. Changing the number of count-in bars mid-run applies on the next start (web parity). `runCountInBars` snapshots it for the BAR display.
- **Denominator:** notation only (web semantics). BPM counts denominator notes, and the layout and buffer are unaffected (tested).
- **Haptic mode:**
  - `setMuted` ramps the output gain to 0 over 5 ms. The loop keeps running, so there is no rebuild and no timing change.
  - The provider fires `Haptics.impactAsync` per step from the foreground poll: Heavy on accents, Medium on downbeats, Light on subdivisions. Polling now runs whenever the app is foregrounded and running, on any tab.
- **Known limitation:** in the background, haptic mode is silent (no poll, so no haptics, and the clicks are muted).
- **Beat events:** the provider keeps no beat state. `useMetronome({ live })` subscribes only while `live` (tab focused) and running, so unfocused tabs do not re-render at beat rate.

### Deviations / notes
- The saved-pattern name uses an inline `TextInput` row in the Grooves sheet (`KeyboardAvoidingView` on iOS) instead of `window.prompt`.
- Text on the accent Play button uses `colors.paper` (`colors.fg` in dark mode). There is no white token, and there are no hard-coded colours.
- Chip `style` lands on the outer `Pressable`, so web `minWidth`/centring on signature chips is dropped. The chips are content-sized.

### Check on the phone (new dev build)
1. 120 BPM with count-in 1 and 2 bars:
   - The count-in clicks (1200 Hz, no subdivisions) flow into the pattern without a gap or double click.
   - The strip shows `● count-in`, then `● live`, with BAR 001 on the first pattern bar.
   - Repeat with the screen locked during the count-in.
2. Change BPM, numerator and subdivisions during the count-in and while live: no glitches, and BAR keeps counting.
3. Haptic mode:
   - Clicks go silent with no pop. Haptics are strong, medium and light per step and feel in time (poll jitter is up to about 16 ms).
   - Switch tabs: haptics continue. Background: silence (expected).
4. Dial drag inside the `ScrollView`, the signature pill tap, and horizontal scroll of 12 beat columns (Bulería).
5. Note glyphs `𝅗𝅥` / `𝅘𝅥𝅯` (2 and 16) may not exist in the bundled fonts. Check that they render.
6. Grooves sheet: Save current with the keyboard open (Android: is the row hidden behind the keyboard?), apply, delete, and persistence after an app restart. Config persistence after restart too.
7. The brand dot pulses at 2 beats while running.
8. The Settings gear opens `/settings`.
