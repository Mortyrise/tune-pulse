# 07 — Tuner UX: port the web behaviour (sticky note, hold-to-confirm, chromatic/instrument)

Read `00-overview.md`, `02-tuner.md` first.

## Device feedback (Android, user)

Detection is better than the browser, but **chromatic mode and "holding the note" felt better in the browser** (UX). The PoC screen shows "—" as soon as a frame is rejected and has none of the web behaviour.

## Scope — behaviour, not the final visual design

Port from the web app (repo root) the tuner *behaviour*:
- `src/screens/TunerScreen.tsx`: `useStickySample` (keep last valid note 1.5 s through silence/rejected frames), hold-to-confirm (in tune ±tolerance for 1.5 s → confirmed state), history strip logic (12 entries, 800 ms throttle per same note), narrative text ("Flat · push up"…), colour thresholds, closest-string matching.
- `src/lib/instruments.ts` → copy to `src/core/instruments.ts` (pure TS; you own this new file only — 06 owns the rest of `src/core`).
- Chromatic vs instrument mode (guitar / bass / ukulele / violin) with a simple selector; A4 reference preset (440/442 at least); tolerance ±5 default.
- Consider light smoothing of the displayed cents (e.g. median/EMA over last ~3–5 analyses, reset on note change) so the needle doesn't jitter at ~23 analyses/s — the web ran ~94/s. Justify.
- Visuals: plain RN `View`/`Text`/`Pressable`, but readable and pleasant: big note, cents bar or simple needle, colour states, confirmed state obvious, string row for instruments, small history strip. No new dependencies (no SVG lib installed — if you think it's essential, report it).
- Keep the debug line (collapsible) and the preset toggle; presets come from `src/audio/tuner.ts` (owned by 06, which may export `TUNER_PRESETS`; code defensively against `'full' | 'light'` today and check 06's doc before finishing).
- Keep: stop on AppState background, stop when tab inactive, keep-awake.

## Ownership

`src/hooks/useTuner.ts`, `src/screens/TunerScreen.tsx`, new `src/core/instruments.ts` (+ its test), new files under `src/tuner-ui/` if you want to split components/hooks. Do not edit `src/audio/tuner.ts` or other `src/core/*` files.

## Acceptance

- `npx tsc --noEmit` clean; pure logic (sticky, hold, history, closest string, smoothing) in testable functions with vitest tests.
- The Metro dev server is running and the user's phone hot-reloads — keep the app compiling at every save (avoid half-written states that crash the screen).

## Plan

**Ported web behaviour** (from root `src/screens/TunerScreen.tsx`, `useTunerSettings.ts`, `lib/instruments.ts`), all as pure functions:
- `src/core/instruments.ts`: verbatim copy of `INSTRUMENTS` / `getInstrument` + `findClosestString(midi, strings)` (moved out of the screen). Detection stays chromatic; instruments only pick and highlight the closest string and show its semitone delta, as on the web.
- `src/tuner-ui/display.ts`: one pure reducer `reduceView(state, event, cfg)`. Events: `{sample, at}` (one per analysis), `{tick, at}`, `reset`. cfg: `{ referenceA4, inTuneCents }`. It carries:
  - **sticky**: keeps the last valid note 1.5 s (`STICKY_HOLD_MS`) after the last accepted frame. Rejected frames (freq 0) don't clear it, and expiry is checked on every event.
  - **hold-to-confirm**: `inTuneSince` is set when the smoothed |cents| <= tol and cleared when it leaves the band, the note changes or sticky expires. `holdProgress = min(1, (at - inTuneSince) / 1500)`, `confirmed = progress >= 1`.
  - **history**: last 12 `{cents}` entries, throttled to 800 ms per same midi, with an immediate push on a new note (exactly the web rule).
  - helpers `narrative(cents)` (web copy), `centsTone(cents, tol) → 'good'|'warn'|'bad'` (near = 3 x tol), `TONE_COLORS` (handoff tokens #4A7C3A / #D49A2B / #B83A2A).
- Settings, kept in screen state: instrument (chromatic|guitar|bass|ukulele|violin), A4 presets `415 432 438 440 442 444` (default 440), tolerance `3|5|10` (default 5), notation `C-D-E / Do-Re-Mi` (cheap, `formatNoteName` already supports it). **In-memory only**: no AsyncStorage installed, see questions.

**Smoothing decision**: work in the log domain (`midiFloat = 12*log2(f/A4)+69`) on accepted frames only. Steps: (1) median of the last 3 midiFloats, which kills single-frame octave/harmonic glitches before rounding to a note; (2) EMA with alpha = 0.5 on the median for the displayed cents. Reset both buffers when the rounded note changes, when A4 changes, or when sticky expires. Cost at ~23 analyses/s: median-3 adds about one hop (~43 ms), EMA tau about 1 hop. Total added lag is under 100 ms, the window where the needle still feels instant. The web at ~94/s got the same visual steadiness from its frame rate, so we need a little filtering to match. Hold and colour use the smoothed cents, history uses the per-frame median. Alpha and N are constants for tuning on the device.

**Data flow / hooks**: `useTuner` (mine) keeps its public API (`status, error, sample, debug, start, stop`) and adds `view`. The audio callback pushes `{sample, at}` into a small ref queue. The existing 33 ms interval drains the queue through `reduceView`, adds a `tick` event (sticky expiry and hold progress also advance while silent), and calls `setView` only when the view changed. This keeps every analysis (no loss to the 30 fps throttle) and gives one render per tick at most. cfg comes from a ref the screen updates. `stop()` resets the view and history, as `handleStop` does on the web. AppState stop, the `active` prop stop and keep-awake stay as they are.

**Screen layout** (plain View/Text/Pressable, no SVG):
```
[Chromatic][Guitar][Bass][Ukulele][Violin]     <- chips, horizontal scroll
A4 440 v   tol +/-5 v   clarity 92%   [check IN TUNE]
                 A#  (96pt, tone colour; sharp sign smaller)
                 OCT 3
  b |-----:-----:==|==:-----:-----| #   cents bar -50..+50, green zone = +/-tol,
            needle (tone colour)          ticks at -25/0/+25
  [========          ] hold progress (green, fills over 1.5 s)
  -2.0 c  Flat . push up          219.75 Hz / target 220.00
  Recent  . . o . . o o . . . . .  (12 cells, dot offset = cents/50)
  Strings: E2 [A2] D3 G3 B3 E4  (+1 st)   | chromatic: "Any pitch . 12 notes"
  [C-D-E | Do-Re-Mi]                  [ Start / Stop ]
  > debug (tap to expand): preset chips + existing stats line
```
A4/tol open as a row of chips inline (no bottom sheet). Idle/error states reuse the current button and error text.

**File split**: `src/core/instruments.ts` + `instruments.test.ts`. `src/tuner-ui/display.ts` + `display.test.ts` (reducer, smoothing, narrative, tone). `src/tuner-ui/components.tsx` (CentsBar, HoldBar, HistoryStrip, StringRow, ChipRow, DebugPanel). `src/hooks/useTuner.ts` (queue + view). `src/screens/TunerScreen.tsx` (composition + settings state). Presets: `import * as tunerAudio` and read `TUNER_PRESETS ?? ['full','light']` defensively. I re-check 06's doc before finishing.

**Tests (vitest, node)**: closest string (ties, bass/ukulele re-entrant tuning order), sticky (holds through freq-0 frames, expires at 1.5 s via tick), hold (confirms at 1500 ms, resets on leaving band / note change / tolerance change), history (12 cap, 800 ms same-note throttle, immediate on note change), smoothing (single octave outlier rejected, EMA converges, reset on note change and A4 change), narrative and tone boundaries (5/12/30, near = 3 x tol).

**Keeping Metro green**: build order is leaf-first. New files (`core/instruments`, `tuner-ui/display`, tests, `components.tsx`) are imported by nothing until they are complete, and I run tsc + vitest on each. Then `useTuner`: an additive change (the new `view` field), written as one full-file Write, so the old screen keeps working. Last, `TunerScreen.tsx` swapped in one Write after `tsc --noEmit` passes on the rest. No partial Edits on files that are already imported. Final check: tsc and vitest again.

## Result

**Lead's answers applied:** settings are in memory only; cents are measured against the nearest note (web parity), and instruments highlight the closest string with its semitone delta; one `Haptics.notificationAsync(Success)` per confirm; the notation toggle is kept; smoothing is named constants (`MEDIAN_N = 3`, `EMA_ALPHA = 0.5` in `display.ts`).

**Files**
- `src/core/instruments.ts` (+ `instruments.test.ts`): copy of the web file plus `findClosestString` (first string wins on ties, as on the web).
- `src/tuner-ui/display.ts` (+ `display.test.ts`): pure `reduceView(state, {sample|tick}, cfg)` with sticky (1.5 s), median-3 + EMA smoothing in the midi domain, hold-to-confirm (1.5 s, `confirmCount` for the haptic), history (12, 800 ms per same note), `narrative`, `centsTone` (tol / 3×tol), `TONE_COLORS`. It returns the same object when nothing changed. One deviation from the plan, found by a test: while the median buffer is still filling (2 frames), `robustMedian` picks the real value closest to the current EMA instead of averaging, so a jump E→A never shows a phantom note in between.
- `src/tuner-ui/components.tsx`: `ChipRow`, `CentsBar` (−50..+50, green ±tol zone, ticks at ±25/0, needle), `HoldBar`, `HistoryStrip`, `StringRow`, `Collapsible`.
- `src/hooks/useTuner.ts`: `useTuner(viewConfig)` now also returns `view`. Every analysis is queued with a timestamp. The 33 ms interval folds the queue + a tick through `reduceView` and calls `setView` only on change. Stop/start reset the view. AppState stop, `active` stop and keep-awake are unchanged.
- `src/screens/TunerScreen.tsx`: rebuilt on the above (layout as in the plan). A4 and tolerance open inline chip rows.
- **06 contract:** 06's `TUNER_PRESETS` / `DEFAULT_TUNER_PRESET` and the extra stats (`lowpassHz`, `rmsThreshold`, `voiced`, `rejGate`, `rejClarity`, `rejNoPeak`, `last: MpmDebug`) are **not in `tuner.ts` yet**. They are read optionally: presets through `import * as tunerAudio` with a `full`/`light` fallback, and stats through an optional-field cast in `useTuner`. When 06 lands they show up with no change here. Optional cleanup after 06 lands: replace the cast with direct imports.

**Checks run here:** `npx tsc --noEmit` is clean. `npx vitest run` gives 6 files, 138 tests, all passing (27 of them new: 7 instruments, 20 display). No failures in 06's files at the time of the run.

**On the phone (dev build, Metro hot reload)**
1. Chromatic, sustained A4 / any string: the note doesn't flicker to "—" between plucks. It stays about 1.5 s after the sound dies, then clears.
2. The needle is steadier than before on a sustained note, with no noticeable extra lag when you turn the peg. If it feels sluggish, raise `EMA_ALPHA` (0.7). If it's still jittery, lower it (0.3).
3. Hold in tune (green zone) about 1.5 s: the hold bar fills, then the "✓ IN TUNE" badge plus **one** haptic tick. Leaving the band resets the bar. Re-entering confirms (and buzzes) again.
4. Octave glitches: pluck low E2 hard. Single-frame jumps to E3 should not show.
5. History strip: one dot about every 0.8 s on a held note, a new dot right away on a note change, max 12. Dots go up when sharp, colour by tone. It clears on Stop.
6. Guitar/Bass/Ukulele/Violin: the closest string is highlighted (accent; green when in tune on that exact string). The header shows `string N · ±x st` when off by semitones, or the cents when on the string.
7. A4 → 442: a 442 Hz tone reads A4 at 0 ¢, and the note resets cleanly on change. Tolerance ±3/±10: the green zone width and the confirm threshold follow it.
8. The Do–Re–Mi toggle changes the big note and the string labels.
9. DEBUG (tap): preset chips (restarts the tuner); once 06 lands, `full / light / raw` with labels plus the last-analysis line (reason, raw Hz, clarity, rms, hf %) and the rejection counters.
10. Still OK: stop on tab switch / background (mic indicator goes away), screen stays awake while running, error text on denied permission.
