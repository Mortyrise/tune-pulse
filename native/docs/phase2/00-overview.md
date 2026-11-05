# TunePulse native — Phase 2: pulse·groove UI

Phase 1 (PoC, `docs/poc/`) proved the native audio path on a real Android phone: tuner detection better than the browser, metronome keeps playing with the screen off. Phase 2 ports the **pulse·groove design** (`../../handoff/README.md`, prototypes in `../../handoff/prototypes/`) and the web app's full UX (`../../src/`) to native, so the app looks and feels like the PWA — modern and functional. Mobile layout only (no desktop dashboard).

## Stack additions (installed — do NOT install anything; report needs to the lead)

`expo-router`, `react-native-screens`, `react-native-gesture-handler`, `react-native-reanimated` 4 + `react-native-worklets`, `react-native-svg`, `@react-native-async-storage/async-storage`, `expo-font`, `@expo-google-fonts/{inter,jetbrains-mono,fraunces}`. Read `../../AGENTS.md` (versioned Expo docs; never trust memory for Expo/RN APIs). Check Reanimated 4 / gesture-handler 3 / svg 15 APIs against `node_modules`.

A new dev build with these native modules is being produced; until the user installs it, the phone runs the old APK — that's fine.

## Contracts (stubs exist — implement, don't change signatures without telling the lead)

- `src/theme/index.tsx` — `ThemeProvider`, `useTheme(): { mode, setMode, colors: ThemeColors, fonts: ThemeFonts }`. Colors = handoff tokens camelCased. Fonts = family name per weight. **Every component styles itself only from `useTheme()`** (no hard-coded colours/fonts).
- `src/settings/index.tsx` — `TunerSettingsProvider`, `useTunerSettings(): { settings, updateSettings, hydrated }`, `usePersistentState(key, initial)`.
- **Atoms** (`src/components/atoms/*`, owned by 09): same names and props as the web atoms in `../../src/components/atoms/` (`Dial`, `PulseRings`, `CentsRing`, `BeatColumn`, `SubdivisionCluster`, `HistoryStrip`, `Chip`, `BottomSheet`), adapted only where RN forces it (e.g. `onClick` → `onPress`; document every deviation in 09's doc under "Contract"). 10/11/12 code against the web props.
- Tuner behaviour: `src/hooks/useTuner.ts` + `src/tuner-ui/display.ts` (phase 1, task 07) — reuse, extend only if needed.
- Metronome engine: `src/audio/metronome.ts`, `metronomeLayout.ts` (phase 1, task 03).

## Ownership

| Paths | Task |
|---|---|
| `src/theme/*`, `src/settings/*`, `src/app/**` (expo-router routes + layouts), `src/components/TabBar.tsx`, `src/components/BrandMark.tsx` (if any), `App.tsx`, `index.ts`, `package.json` `main` field, `app.json` | 08-foundation |
| `src/components/atoms/*` (+ tests), `src/components/Icon.tsx` | 09-atoms |
| `src/screens/TunerScreen.tsx`, `src/tuner-ui/*`, `src/hooks/useTuner.ts` | 10-tuner-screen |
| `src/screens/MetronomeScreen.tsx`, `src/metronome-ui/*`, `src/hooks/useMetronome.ts`, `src/hooks/MetronomeProvider.tsx`, `src/hooks/useTapTempo.ts`, `src/hooks/useSavedPatterns.ts`, `src/core/grooves.ts`, `src/core/tempo.ts`, `src/audio/metronome*.ts` | 11-metronome-screen |
| `src/screens/SettingsScreen.tsx` | 12-settings-screen |

Screens are default exports with no required props; 08's routes render them. The metronome must keep playing across tabs (provider above the navigator — 11 provides `MetronomeProvider`, 08 mounts it in the root layout).

## Process

1. Plan into your doc's `## Plan` (no code). Stop and report.
2. Lead approves. Order of implementation: 08 + 09 first (in parallel, 09 uses the theme stub), then 10 / 11 / 12.
3. Implement only your files; keep the app compiling at every save (Metro hot-reloads the user's phone). `npx tsc --noEmit`, `npx vitest run`, `npx expo lint` from `native/`. Fill `## Result`.
4. Lead reviews. No git commits, no branches.
