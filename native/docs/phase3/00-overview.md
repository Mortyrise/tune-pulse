# TunePulse native — Phase 3: release readiness

Phase 2 (pulse·groove UI) is on main and works on the user's Android phone. Phase 3 gets the app ready to ship on Google Play (internal testing first) and closes the gaps left by the PoC. The user has an active Google Play Console account.

## Tasks and ownership

| Task | Owns |
|---|---|
| 13-android-release | `app.json` (icon, splash, version, android config), `eas.json`, `assets/*`, new `docs/store/*` (listing, privacy policy, data-safety answers, release runbook), new `scripts/*` for asset generation |
| 14-audio-robustness | `src/audio/session.ts`, `src/audio/tuner.ts`, `src/audio/metronome*.ts`, `src/hooks/useTuner.ts`, `src/hooks/useMetronome.ts`, `src/hooks/MetronomeProvider.tsx` |
| 15-cleanup-docs | root `README.md`, root `ROADMAP.md`, `native/README.md`, `docs/poc/device-test-checklist.md` (→ updated full-app checklist), dead code anywhere **outside** 13/14/16 files (report instead of editing if it's in their files) |
| 16-web-detection-parity | web PWA only (repo root `src/**`): `src/audio/worklets/mpm-processor.js`, `src/audio/pitchDetector.ts`, `src/hooks/useTuner.ts` (web) |

Rules as before: read `../../AGENTS.md` (Expo: versioned docs, never trust memory), don't install packages (report needs), keep the app compiling (Metro may be hot-reloading the phone), no git commits. Plan first into your doc, stop, wait for approval, implement, fill Result.

Verification from `native/`: `npx tsc --noEmit`, `npx vitest run`, `npx expo lint`, `npx expo-doctor`. Web (repo root): `npm run build`, `npm run lint`.
