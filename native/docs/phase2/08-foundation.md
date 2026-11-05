# 08 — Foundation: theme, fonts, persistence, navigation

Read `00-overview.md`.

## Scope
- **Theme** (`src/theme/`): light / dark / mono from the handoff tokens; persisted choice; default follows the system scheme until the user picks one (or default light — decide and justify). Status bar style per theme.
- **Fonts**: Inter (300–700), JetBrains Mono (300–600), Fraunces (300–600 + italic) via `@expo-google-fonts/*` + `useFonts`; keep the splash until loaded (expo-splash-screen is part of expo — verify).
- **Persistence** (`src/settings/`): AsyncStorage-backed `usePersistentState`, `TunerSettingsProvider` (same keys/semantics as the web `useTunerSettings`, clamp A4 400–480), `hydrated` flag.
- **Navigation**: migrate to **expo-router** (`src/app/`): root `_layout.tsx` (fonts, ThemeProvider, TunerSettingsProvider, MetronomeProvider from `src/hooks/MetronomeProvider.tsx` — owned by 11; until it exists, import defensively or create a placeholder there and tell 11), tabs layout with the handoff **custom bottom tab bar** (`handoff/README.md` → "Tab bar"; web `src/components/TabBar.tsx`) for Tuner / Metronome / Settings, safe areas, edge-to-edge. Update `package.json` `main` to `expo-router/entry`, remove `App.tsx`/`index.ts` when routes work. Keep the `active` semantics the current screens need (tuner stops when its tab isn't focused — use `useIsFocused`/`useFocusEffect` inside routes and pass `active`).
- Brand mark / header if the handoff has one shared by screens.
- `app.json`: `scheme` for expo-router, `userInterfaceStyle: automatic` only if theme follows system (expo-system-ui is NOT installed — report if needed).

## Acceptance
tsc / vitest / lint clean; app boots to tabs with fonts and theme; theme switch re-renders everything; settings survive app restart.

## Plan

> **Lead decisions (override the plan below):** `expo-splash-screen` and `expo-system-ui` are installed; theme follows the system until the user picks a mode (`userInterfaceStyle: automatic`); **two tabs** + `/settings` as a pushed stack screen (root Stack: `(tabs)` + `settings`); switch `main` without waiting; `scrim` token added; updater setter + `validate` approved.

**Verified APIs (node_modules, expo-router 58.0.30):** `Tabs` from `expo-router/js-tabs`; the `expo-router` root export is `@deprecated`. It takes `tabBar={(p: BottomTabBarProps) => …}`, `sceneStyle`, `lazy`, `freezeOnBlur`. `useIsFocused` / `useFocusEffect` come from `expo-router`. `ExpoRoot` already wraps the app in `SafeAreaProvider`, so we don't add another. **`expo-splash-screen` is NOT installed.** expo-router's `SplashScreen` export is `@hidden` and does nothing without the `ExpoSplashScreen` native module. **AsyncStorage 2.2.0 throws at import time** when its native module is missing, which is the case on the old APK. `userInterfaceStyle: automatic` is ignored on Android without `expo-system-ui`, which is not installed (docs: color-themes).

**Route tree** (`src/app/`, no groups and no stack for now):
- `_layout.tsx` contains the providers and `<Tabs tabBar={TabBar} screenOptions={{ headerShown:false, sceneStyle:{backgroundColor:colors.bg}, freezeOnBlur:false }}>`. `freezeOnBlur:false` lets a blurred tuner re-render with `active=false`.
- `index.tsx` renders Tuner, `metronome.tsx` renders Metronome, `settings.tsx` renders Settings. 10's `router.push('/settings')` switches tabs.

**Provider order** (root `_layout`): `GestureHandlerRootView(flex:1, bg)` > `ThemeProvider` > `FontGate` > `TunerSettingsProvider` > `MetronomeProvider` > `ThemedStatusBar` + `Tabs`.
- `FontGate` renders nothing until fonts are loaded or have failed and the theme has hydrated, so the light theme never flashes before dark.
- Settings and the metronome are not gated. They expose `hydrated`, which keeps first paint fast.

**Fonts + splash:**
- `ThemeProvider` calls `useFonts` from `expo-font` with 13 faces from `@expo-google-fonts/*`. These are Inter 300/400/500/600/700, JetBrains Mono 300/400/500/600, and Fraunces 300/400/600/400-italic.
- `fonts` maps each weight to the family name, e.g. `sans.semibold = 'Inter_600SemiBold'`.
- If fonts fail to load (`error`), it falls back to `SYSTEM_FONTS` and the app still renders.
- **Splash:** I'm asking the lead to add `expo-splash-screen` to the dev build that is being made now, with plugin `backgroundColor #EEE7D6`, `dark.backgroundColor #0F0E0C`. With it: call `SplashScreen.preventAutoHideAsync()` at module scope and `SplashScreen.hide()` when `FontGate` opens.
- Without it: `FontGate` shows a full-screen `View` in `LIGHT.bg` (no white flash, no import).

**Theme:**
- `src/theme/tokens.ts` holds `LIGHT`, `DARK` and `MONO` from the handoff. Mono has no `accent-deep` in the handoff, so it uses its accent `#100F0D`.
- The mode is saved with `usePersistentState('tunepulse:theme', 'light', isThemeMode)`, the same key as the web.
- **Default: `light`.** The handoff calls light the default. Following the system needs `expo-system-ui` plus `userInterfaceStyle: automatic` and a native rebuild. It would also only change the first launch, because after that the user's choice is saved. If the lead adds `expo-system-ui` to the build, I'll switch the default to `useColorScheme()` until the user picks a mode.
- `ThemedStatusBar` uses `expo-status-bar` with `style = mode==='dark' ? 'light' : 'dark'`. RN 0.88 is edge-to-edge, so no background colour is needed.
- The context value is memoised on `[mode, fontsReady]`, so switching theme re-renders every consumer.

**Settings persistence** (`src/settings/`):
- `storage.ts` loads AsyncStorage with a lazy `require` inside try/catch. If that fails, it falls back to an in-memory `Map` and warns once in dev. This keeps the old APK running.
- `usePersistentState(key, initial, validate?)` starts at `initial` with `hydrated=false`. It reads with `getItem` and `JSON.parse`, then runs `validate` (bad data becomes `initial`).
- Writes are fire-and-forget `setItem`. If the user writes before hydration finishes, the late read is ignored.
- The setter also accepts an updater function, `(next: T | ((prev:T)=>T))`. The optional 3rd parameter and the updater are additive changes to the contract, which I'll tell the lead about.
- `sanitize.ts` ports the web `loadSettings` validators (pure, with vitest tests). `TunerSettingsProvider` uses key `tunepulse:tuner-settings`, the same as the web. `updateSettings(patch)` merges, then sanitises, which clamps A4 to 400–480 with `Math.round`. `hydrated` comes from the hook.

**Tab bar** (`src/components/TabBar.tsx`, `BottomTabBarProps`), following the web `TabBar`:
- Outer view: `paddingBottom: insets.bottom`.
- Inner pill: `bg paper`, hairline `borderStrong`, radius 14, padding 4, gap 4, `marginHorizontal 18`, `marginTop 8`, `marginBottom 12`, `maxWidth 380`, `alignSelf center`. The web uses 24px; on a phone the nav inset already adds room.
- Tab: flex 1, row, gap 8, radius 10, `paddingVertical 10`. Active tab: `bg` colour with a hairline `borderStrong`, `fg` text. Inactive: transparent, `muted` text.
- Label: `fonts.sans.semibold` 12px, letterSpacing 0.24. Icon: 15px from 09's `Icon` (`audioWaveform` / `timer` / `settings`); labels only until 09 lands.
- On press: `navigation.emit({type:'tabPress', canPreventDefault})`, then `navigate`. `accessibilityRole="tab"` with `accessibilityState.selected`.

**`active` / focus:**
- Route wrappers: `const f = useIsFocused(); return <TunerScreen active={f} />`. Same for `<MetronomeScreen active={f} />`, which 11 uses as `uiActive`.
- Tabs keep visited screens mounted, and the metronome engine lives in the root provider, so it survives tab switches.

**BrandMark** (`src/components/BrandMark.tsx`): `BrandMark({ pulseMs?: number })` draws the 7px accent dot and `PULSE·GROOVE` (mono medium 10.5, letterSpacing 1.9, muted). The dot pulses with Reanimated, `withRepeat` scale 1 to 0.65 and opacity 1 to 0.5, with period `pulseMs ?? 2000`. Screens build their own top bar around it. 10 uses it, and 11 passes `beatPeriodMs*2` while running.

**Migration** (the phone runs the OLD APK, which has no router/screens/RNGH/reanimated/svg/AsyncStorage natively):
1. Implement theme and settings, keeping the stub signatures, with the storage fallback. Wrap the current `App.tsx` in the providers. It still runs on the old APK. `expo-font` is a dependency of `expo`; if `useFonts` throws there, `FontGate` falls back to system fonts.
2. Add `src/app/*`, `TabBar` and `BrandMark` while `main` is still `index.ts`. Metro never bundles them, and tsc/lint check them.
3. **Only once the lead confirms the new dev build is installed:** set `main` to `expo-router/entry`, add `scheme: "tunepulse"` (and the splash plugin if it's in the build), delete `App.tsx` and `index.ts`, and run tsc/vitest/lint.
4. If `src/hooks/MetronomeProvider.tsx` doesn't exist yet at step 2, I create a pass-through placeholder (`({children}) => children`) and tell 11 that the file is theirs to replace.

**Needs from 11:**
- Named export `MetronomeProvider({ children })` in `src/hooks/MetronomeProvider.tsx`, with no other props. It persists through `usePersistentState` and must tolerate `hydrated=false`.
- `useMetronome({ uiActive })` keeps that option, and the engine is not stopped when the screen unmounts.
- `isRunning` and the beat period are exposed so the screen can drive `BrandMark pulseMs`.

## Result

**Done.** `tsc` is clean for every file I own. The only remaining errors are in 09's in-progress `atoms/BeatColumn.tsx`. `vitest` passes 10 files / 188 tests (2 new files). `expo lint` reports 0 errors; its 2 warnings are in other tasks' files. `npx expo export --platform android` bundles, with exactly 13 `.ttf` assets.

**Files**
- `src/theme/tokens.ts`: `LIGHT`, `DARK`, `MONO` (+ `scrim`: 0.42 black, 0.6 black, 0.42 ink) and `THEME_COLORS`. Fonts: `APP_FONTS` and `SYSTEM_FONTS`. Helpers: `parseThemeMode`, `resolveThemeMode(stored, system)`, `statusBarStyle`.
- `src/theme/fonts.ts`: per-weight subpath imports, so only 13 faces are bundled.
- `src/theme/index.tsx`: `ThemeProvider` / `useTheme` as in the contract. `mode` = stored choice ?? system (`useColorScheme`, dark → dark, else light), key `tunepulse:theme`. **New:** `useThemeReady()`, true once fonts are loaded (or failed) and the theme has hydrated. It re-exports `tokens`.
- `src/settings/types.ts`: the contract types and constants plus `TUNER_SETTINGS_KEY`, which is `tunepulse:tuner-settings` (same as the web).
- `src/settings/sanitize.ts`: `sanitizeTunerSettings`, `clampReferenceA4` (400–480, rounded).
- `src/settings/storage.ts`: lazy guarded AsyncStorage `require`, with an in-memory fallback. Also `decodeStored` and `setStorageBackend` (for tests).
- `src/settings/index.tsx`:
  - `usePersistentState(key, initial, validate?)` returns `[value, set(next | prev => next), hydrated]`. The setter is stable. A write made before hydration beats the late read. Writes go through an effect.
  - `TunerSettingsProvider`: `updateSettings(patch)` merges and sanitises.
- `src/components/TabBar.tsx`: handoff pill. The icon comes from each screen's `tabBarIcon`, using 09's `Icon` (`audioWaveform` / `timer`, 15px, stroke 1.6). Bottom spacing is 12px plus the safe-area inset.
  - Note: in expo-router 58, `BottomTabBarProps` is `{ state, descriptors, emitter, navigateToTab, insets }`. There is no `navigation` prop.
- `src/components/BrandMark.tsx`: `BrandMark({ pulseMs = 2000 })`. Reanimated pulse (`progress.set`/`get`), mono medium 10.5, uppercase.
- `src/app/_layout.tsx`:
  - Providers: `GestureHandlerRootView` > `ThemeProvider` > (splash held until ready) `TunerSettingsProvider` > `MetronomeProvider` > `StatusBar` + `Stack`.
  - `SplashScreen.preventAutoHideAsync()` runs at module scope and `hide()` runs when ready. `SystemUI.setBackgroundColorAsync(colors.bg)` runs whenever the theme changes.
  - The `settings` screen has a native header with a back button: bg colour, fg tint, Inter semibold 15, no shadow.
- `src/app/(tabs)/_layout.tsx`: `Tabs` from `expo-router/js-tabs` with `headerShown:false`, `freezeOnBlur:false` and `sceneStyle {bg, paddingTop: insets.top}`. **Tab screens get the top inset from here, so they must not add their own.**
- `src/app/(tabs)/index.tsx` / `metronome.tsx`: `useIsFocused()` → `active`.
- `src/app/settings.tsx`: renders the Settings screen.
- `app.json`: `scheme: "tunepulse"`, `userInterfaceStyle: "automatic"`. The `expo-splash-screen` plugin has `backgroundColor #EEE7D6` and `dark.backgroundColor #0F0E0C`. These are native settings, so they apply only from the build that includes them.
- `package.json`: `main` = `expo-router/entry`. `App.tsx` and `index.ts` are deleted.

**Placeholders (owners replace them; the export shape must stay the same)**
- `src/hooks/MetronomeProvider.tsx` (11): pass-through named export `MetronomeProvider({ children })`.
- `src/screens/SettingsScreen.tsx` (12): did not exist, so `/settings` would not compile. Minimal default-export placeholder. 12 should **not** render its own back header; the stack header provides it.

**Notes for 10/11/12**
- Gear → `router.push('/settings')`.
- `BrandMark` comes from `src/components/BrandMark`.
- `colors.scrim` is for sheets.
- Don't add a top safe-area inset in tab screens.
- The old APK will crash on the new entry (no router/screens/svg/AsyncStorage natively). The user needs the new dev build.

**Follow-ups from 12 (added after the main pass)**
- **Theme contract, additive change:**
  - `Theme.preference: ThemeMode | 'system'` is the user's choice.
  - `setMode` accepts `ThemeMode | 'system'`; `'system'` clears the stored choice, so the theme follows the OS again.
  - `mode` is still the resolved light/dark/mono.
  - New pure helpers in `tokens.ts`: `ThemePreference`, `preferenceFromStored`, `storedFromPreference`. They are tested in `tokens.test.ts`, including the round trip of picking dark and then going back to system.
- **Settings header:** the native header now has `title: ''` and `headerBackTitle: ''`, and still shows the back button. It uses the theme's bg colour with fg tint and no shadow. It is not `headerTransparent`: since its colour is the page colour it looks the same, and the screen doesn't need to handle the top inset. The design's in-page title is now the only title.
- **Checks:** tsc and eslint are clean for my files. vitest passes 11 files / 196 tests.
