# 15 — Cleanup and docs

Read `00-overview.md` and skim `../poc/*` and `../phase2/*` Results.

## Scope
- Root `README.md` and `ROADMAP.md`: describe the two apps (PWA at root, native Expo app in `native/`), how to run each, current status (native phase 1+2 done, phase 3 in progress), and update the roadmap blocks (desktop dashboard still web-only, etc.).
- `native/README.md`: current architecture (routes, theme, settings, atoms, audio engine, core), scripts (`test`, `lint`), dev-client + tunnel workflow that actually worked for the user (WSL2: `npx expo start --dev-client --tunnel`, QR with `exp+tunepulse://expo-development-client/?url=...`, APK sideload via USB when the phone's download fails), EAS build commands.
- `docs/poc/device-test-checklist.md` → move/rename to `docs/device-test-checklist.md` covering the whole app (phase 2 screens, metronome features, themes, settings persistence) and leave a robustness section placeholder that 14 will fill (the lead will merge 14's list).
- Dead code / leftovers from the PoC outside other tasks' files (e.g. unused exports, stale comments mentioning "stub"/"PoC", the `.claude/settings.json` from the template — check what it does before proposing removal). For anything inside 13/14/16-owned files, list it in Result instead.
- Make sure `npm test` / `npm run lint` scripts exist in native/package.json (report if package.json needs changes — the lead edits it).

## Acceptance
Docs accurate to the code (spot-check commands and paths); tsc/vitest/lint clean.

## Plan

**Root `README.md`** (PWA stays the main subject, native gets its own section)
- Intro: TunePulse = two apps sharing the same design and DSP: web PWA (repo root) + native Android/iOS app (`native/`, Expo SDK 58, dev build).
- New "Apps" table: path, stack, how to run (`npm run dev` / `cd native && npx expo start --dev-client --tunnel`), status. Link `native/README.md`.
- Status: PWA mobile feature-complete; native phases 1 (PoC: native tuner + background metronome) and 2 (pulse·groove UI port) done and on the user's Android phone; phase 3 (Play internal testing, audio robustness) in progress.
- Keep Stack/Scripts/Architecture/Notes for the web; one line that `native/src/core` ports `lib/notes`, MPM, grooves, tempo from the web.

**Root `ROADMAP.md`**
- Status date → November 2026; add "Native app" row(s) to Completed (N1 PoC, N2 UI port) and a "Native phase 3" block (Play internal testing via 13, audio robustness 14, web detection parity 16 — FFT MPM/lowpass port back to the PWA).
- Block 3 desktop dashboard: say explicitly web-only (native is portrait phone). Block 5: note native already has Vitest for core logic (web still none).
- Post-MVP: native iOS build (needs Apple dev account), store release after internal testing. Leave backlog items as is.

**`native/README.md`** (rewrite; drop "(PoC)" and "deliberately plain UI")
- What it is + why native (mic PCM, background metronome); Expo Go won't work.
- Architecture tree: `src/app` (expo-router: `(tabs)/index` tuner, `(tabs)/metronome`, `settings` stack, `_layout` providers order), `screens/`, `tuner-ui/`, `metronome-ui/`, `components/` + `atoms/`, `theme/` (tokens light/dark/mono, fonts), `settings/` (AsyncStorage w/ memory fallback, sanitize), `audio/` (session, tuner, metronome engine/layout/config), `hooks/`, `core/` (pure TS: MPM+FFT, biquad, notes, instruments, grooves, tempo; all unit-tested). Mention hidden DebugPanel (long-press tuner label).
- Scripts: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx expo-doctor`.
- Dev workflow that worked (WSL2): `npx expo start --dev-client --tunnel` (@expo/ngrok devDep); if QR scan fails open `exp+tunepulse://expo-development-client/?url=<tunnel url>`; APK download fails on phone → download on PC and `adb install` over USB. When a rebuild is needed (native deps / app.json).
- EAS: `npx eas-cli@latest build --profile development|preview --platform android`; production/store → link to 13's `docs/store/*` runbook (don't duplicate). Keep Troubleshooting, update paths.

**Checklist**: `git mv docs/poc/device-test-checklist.md docs/device-test-checklist.md` (fix links in README + any phase docs that reference it — leave historical poc/phase docs untouched except none link there besides 04 Result, which is history). New sections:
0 header (device, build, date) · 1 Install & permissions (mic, notifications, denied-mic flow) · 2 Tuner accuracy (keep tone table) · 3 Tuner UI (states idle/listening/denied, cents ring, hold-to-confirm, history strip, reference-pitch sheet, instrument target sheet + closest string, notation/♯♭ reflected) · 4 Metronome UI (dial drag/±, tap tempo, signature sheet, per-beat accents + subdivision cluster, count-in, haptic mode, session strip, grooves library + save/rename/delete my grooves, brand pulse) · 5 Metronome timing (keep 5-min/BPM-change/signature-change) · 6 Background/locked/tabs (merge old 4,5,8,9) · 7 Interruptions & Bluetooth (old 6,7) · 8 Settings & persistence (theme light/dark/mono/system + status bar + splash colour, all tuner settings, kill & relaunch restores settings, metronome config, saved grooves; About shows version/versionCode) · 9 **Robustness — placeholder for 14** (lead merges) · Summary.

**Dead code / leftovers (mine, outside 13/14/16)**
- `src/components/Icon.tsx`: `ICON_NAMES` unused → remove export.
- `src/settings/storage.ts`: `setStorageBackend` "test hook" unused by any test → remove (or keep if lead prefers; trivial).
- Stale task-number comments: `TunerScreen.tsx:3` ("09's atoms"), `SettingsScreen.tsx:299` ("11's engine diagnostics") → reword neutrally.
- `.claude/settings.json`: only enables the `expo@claude-plugins-official` plugin (tracked, from the template). Harmless and useful for agents → **keep** (propose, not remove).
- No "stub"/"PoC" strings left in `src/`. `testSignals.ts` exports used only by tests: fine.

**Report to others (not editing)**
- 14: `src/audio/session.ts:1` "Owned by task 04-shell" comment; `getSessionMode` and `requestNotificationPermission` exported but unused; `useMetronome.ts:36` "(task 12)" comment.

**package.json requests (lead)**: `test`/`lint` already exist. Suggest adding `"typecheck": "tsc --noEmit"`; move `eslint-config-expo` from dependencies to devDependencies.

Verify: tsc, vitest, expo lint; spot-check every command/path written in docs.

## Result

**Done** (plan approved with the lead's answers):
- Root `README.md`: short intro, then an "Apps" table (native app = the main mobile app going forward; the PWA is still deployed), link to `native/README.md`. The rest stays web-specific ("Web stack", scripts, architecture, notes).
- Root `ROADMAP.md`: November 2026 status for both apps; Completed gets Native 1 (PoC) and Native 2 (UI port); new "Native phase 3" block (release with a link to `native/docs/store/release-runbook.md`, robustness, web parity, docs); desktop dashboard marked web only; Vitest line notes that native already has it; Post-MVP gets the public Play release and the iOS/TestFlight build.
- `native/README.md`: rewritten without the PoC framing. It covers the architecture tree, providers order, persisted keys, the debug panel, scripts (`npm test`, `npm run lint`, `npm run typecheck`, `npx expo-doctor`), the dev-client build, the APK fallback over USB (`adb install -r`), the WSL2 tunnel workflow with the `exp+tunepulse://expo-development-client/?url=` fallback, preview/production builds (production links to 13's runbook, which doesn't exist yet), docs index and updated troubleshooting.
- Checklist moved (plain `mv`) to `docs/device-test-checklist.md` and rebuilt into sections 1 to 9 plus a summary. Section 9 "Audio robustness" is a placeholder for 14. The historical poc/phase docs that cite the old path were left as they are.
- Dead code: removed `setStorageBackend` (`src/settings/storage.ts`) and `ICON_NAMES` (`src/components/Icon.tsx`). Reworded the task-number comments in `TunerScreen.tsx:3` and `SettingsScreen.tsx:299`. Kept `.claude/settings.json`.

**For 14 (not edited):** `src/audio/session.ts:1` "Owned by task 04-shell" comment; `getSessionMode` and `requestNotificationPermission` (session.ts) exported but unused; `src/hooks/useMetronome.ts:36` "(task 12)" comment.

**Verification** (from `native/`): `npx tsc --noEmit` exit 0; `npx vitest run` 18 files / 254 tests pass; `npx expo lint` exit 0, no output. Spot-checked against the code: scripts in package.json (incl. the lead's `typecheck`), route files, `tunepulse:*` keys, the `eas.json` profiles, scheme `tunepulse`, splash colours, tap-tempo rules (window 4, 2 s reset), count-in options 0/1/2, "Save current" and the long-press debug toggle.
