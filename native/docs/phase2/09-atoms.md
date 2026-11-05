# 09 — Atoms: SVG + Reanimated components

Read `00-overview.md`.

## Scope
Port the web atoms (`../../src/components/atoms/*.tsx`, `svgGeometry.ts`; visual spec in `handoff/README.md` → "Atoms" and "Animations", prototypes in `handoff/prototypes/src/primitives.jsx`) to `src/components/atoms/` with `react-native-svg` + Reanimated 4 + gesture-handler:
- `Dial` (drag to change value over 270° sweep — Pan gesture; haptic tick per integer step optional), `PulseRings` (expanding rings per `tickId`, 950/1200 ms), `CentsRing` (indicator 180 ms ease), `BeatColumn`, `SubdivisionCluster`, `HistoryStrip`, `Chip` (press scale .97), `BottomSheet` (slide-up 220 ms + backdrop 180 ms, swipe-down to dismiss), plus `Icon` (`src/components/Icon.tsx`) — lucide-react is web-only; draw the few icons needed with react-native-svg paths (list which ones the screens need from the web code).
- All colours/fonts from `useTheme()`; animations on the UI thread (shared values), no per-frame React re-renders.
- Same props as the web atoms; list every deviation under `## Contract` **early** (other tasks code against it).
- Pure geometry helpers tested with vitest (`svgGeometry.ts` port).
- A dev-only gallery route is NOT needed; 10/11 will exercise the atoms.

## Acceptance
tsc / vitest / lint clean; no hard-coded colours; gestures don't fight scroll views.

## Contract
Import from `src/components/atoms/<Name>` (named exports, same names as web, plus `XxxProps` types). Props identical to the web atoms unless listed. `Subdivision` comes from `src/audio/metronomeLayout` (not `metronomeScheduler`).

- **Dial** `{ value, min, max, onChange(v), size=270, isRunning?, children? }` + **`haptics?: boolean`** (default **true**; selection tick per integer step via expo-haptics). `onChange` fires on the JS thread only when the rounded value changes. Children render in a centred `pointerEvents="box-none"` overlay: any `Pressable` child is tappable (replaces web `.pg-no-drag`; a tap never starts a drag, the pan activates after 4 px). Once dragging, the dial owns the touch: if the dial sits in a scroll container, use gesture-handler's `ScrollView` (`import { ScrollView } from 'react-native-gesture-handler'`). Adds an a11y `adjustable` role (increment/decrement ±1).
- **PulseRings** `{ tickId, isRunning, isAccent, size=260 }` — unchanged. Renders `StyleSheet.absoluteFill`, `pointerEvents="none"`, centred; the parent must be `position: relative`-like (any View) with the Dial on top.
- **CentsRing** `{ cents, active, noteLabel, accidental?, octave?, size=290, holdProgress=0 }` + **`inTuneCents?: number`** (default 5). Colour: good ≤ inTuneCents, warn ≤ 3×inTuneCents, else bad (web 5/15 = default). The green/amber bands scale with it (9.6°/27° at 5¢, ×inTuneCents/5, capped at 90°).
- **HistoryStrip** `{ history: HistorySample[] }` + **`inTuneCents?: number`** (default 5), same thresholds. `HistorySample = { cents: number }` exported.
- **BeatColumn** `{ beat, isAccent, subdivision, currentBeat, currentSub, isRunning, inCountIn, onToggleAccent, onCycleSubdivision }` — unchanged (callbacks are press handlers).
- **SubdivisionCluster** `{ count, isActive, subIndex }` — unchanged.
- **Chip** `{ active?, children, onPress?, disabled?, style?: StyleProp<ViewStyle>, accessibilityLabel?, testID? }`. Deviation: `onClick` → **`onPress`**; no `className`/HTML button attrs. String/number children are wrapped in a themed `Text`; other children (e.g. `<Icon/>` + text) laid out in a row, gap 6. Icons inside a Chip inherit its text colour automatically (see Icon).
- **BottomSheet** `{ open, onClose, title, children }` — unchanged. Implemented as a transparent RN `Modal` (covers tab bar; Android back → `onClose`); stays mounted until the exit animation ends. Swipe down on the grabber/header dismisses. Content is not scroll-wrapped; put a `ScrollView` inside if long. Backdrop colour = `colors.scrim`.
- **Icon** (`src/components/Icon.tsx`) `{ name: IconName, size=24, strokeWidth=2, color?, fill?: boolean }` (`fill` = solid shape in the stroke colour, e.g. a filled play button; default false like lucide). Also exports `IconColorContext` (provide a colour for nested icons) and `ICON_NAMES`. `color` defaults to the surrounding Chip's text colour, else `colors.fg` (emulates `currentColor`). Paths copied from lucide (ISC) so it matches the web 1:1. `IconName` (camelCase of the lucide names the web uses): `audioWaveform, timer` (TabBar) · `sun, moon, contrast` (ThemeToggle) · `minus, plus, rotateCcw` (Settings) · `check, chevronRight, chevronLeft, mic, micOff, refreshCw, settings` (Tuner) · `bookmark, bookmarkPlus, hand, pause, play, vibrate, volume2, x` (Metronome). Need another? Ask 09/the lead; adding a name is non-breaking.

## Plan
**Shared helpers** (`atoms/svgGeometry.ts`, pure, every fn marked `'worklet'` so UI-thread code can call it): `polarToCartesian`, `describeArc` (verbatim port) + `dialAngleFromPoint(x,y,cx,cy)` (atan2(x,−y) in deg), `wrapDelta(deg)` (→ −180..180), `dialValueFromDrag(startValue, deltaDeg, min, max)` (round + clamp), `valueToDialAngle(value,min,max)`, `centsTone(cents, inTuneCents) → 'good'|'warn'|'bad'`. `svgGeometry.test.ts` (vitest, no RN imports): arc endpoints / large-arc flag, angle quadrants, delta wrap across ±180, clamp/round, tone thresholds for 3/5/10. Components map tone → `colors.good|warn|bad`.

**Dial** — `react-native-svg` `Svg` + `G`/`Line`/`Text`/`Circle` + `RadialGradient` glow (when `isRunning`). Tick geometry (60 ticks, 5 major labels) memoised on `size,min,max`; per-tick active colour from `value` (re-render only on integer steps, never per frame). Knob = two `AnimatedCircle`s with `useAnimatedProps` `cx/cy` driven by a `knobAngle` shared value, so it tracks the finger at 60 fps between integer steps and snaps back to `valueToDialAngle(value)` (`withTiming` 80 ms) when `value` changes from outside or on release. Gesture (RNGH 3 hooks API, verified in node_modules): `usePanGesture({ minDistance: 4, onBegin, onUpdate, onFinalize })` inside `<GestureDetector gesture>`; callbacks are worklets by default. `onBegin` stores `startAngle = dialAngleFromPoint(e.x, e.y, size/2, size/2)` and `startValue` in shared values; `onUpdate` accumulates `wrapDelta` (so drags past ±180 keep working), computes next, updates `knobAngle`, and if `next !== lastEmitted` → `scheduleOnRN(onChangeJS, next)` (react-native-worklets 0.13 API; `onChangeJS` also fires `Haptics.selectionAsync()` when `haptics`). Scroll interplay: once the pan is active it owns the touch (RNGH cancels JS responder); outside the dial ScrollViews work normally. Children overlay `pointerEvents="box-none"`.

**PulseRings** — pool of 4 `Animated.View` rings (circle via `borderRadius`, border `colors.accent`), each with `scale`/`opacity`/`accent` shared values. `useEffect` on `tickId` (only when `isRunning && tickId !== null`): take next slot round-robin, set start values (scale .42, opacity .8 × (accent .7 / regular .4 base)), then `withTiming` to scale 1.32 / opacity 0 over 1200 / 950 ms, `Easing.bezier(0.16,1,0.3,1)`. Zero React state, no remounts; finished rings simply sit at opacity 0.

**CentsRing** — static layers (base circle, ±90° arc, good/warn bands, ticks, ±25/0/±50 labels, ♭/♯, note/accidental/octave `Text` with `fonts.display.light` / `fonts.mono.regular`, `letterSpacing`) rendered by React. Indicator: `angle` shared value, `withTiming(target, { duration: 180, easing: Easing.inOut(Easing.ease) })` on each `cents` change; `AnimatedCircle` ×2 (`cx/cy`) and `AnimatedLine` (`x2/y2`) via `useAnimatedProps`. Colour is a plain prop (discrete). `holdProgress` arc via `describeArc` in render. SVG `dominantBaseline` is unreliable on Android → use explicit `y` offsets (≈ fontSize·0.35) instead; check visually on device.

**HistoryStrip** — plain `View`s (12 slots, 4 px dots offset ±9 px), labels `fonts.sans.semibold` / `fonts.mono.regular`. No animation.

**SubdivisionCluster / BeatColumn** — `Animated.View` dots and accent bar using **Reanimated 4 CSS transitions** (`transitionProperty: ['backgroundColor','opacity','transform']`, `transitionDuration: 80`, ease), so lit-dot scale 1.4 / colour changes animate on the UI thread with only the discrete prop change crossing React. BeatColumn: two `Pressable`s (accent bar hitSlop to ≥ 32 px tall; subdivision box), `accessibilityRole="button"`, labels as web, `accessibilityState={{ selected: isAccent }}`.

**Chip** — `Pressable` + `Animated.View`; `onPressIn/Out` drive a `scale` shared value (`withTiming` .97 / 1, 90 ms). Height 30, radius 15, hairline `StyleSheet.hairlineWidth` border, active inverts fg/bg. Provides `IconColorContext` with its text colour.

**BottomSheet** — `Modal transparent statusBarTranslucent navigationBarTranslucent animationType="none"`; inner `GestureHandlerRootView` (required for gestures inside Android modals). Internal `mounted` state: `open` → mount + animate in; `!open` → animate out, then `scheduleOnRN(setMounted,false)`. Backdrop `colors.scrim`, opacity 0→1 180 ms; panel `translateY` from measured height (`onLayout`) → 0, 220 ms `Easing.bezier(.2,.9,.3,1)`. Backdrop `Pressable` → `onClose`. Pan on grabber+header (`usePanGesture({ activeOffsetY: 6, failOffsetX: [-20,20] })`): follow finger downward only (rubber-band up ×0.2); on end dismiss if `translationY > 25% height || velocityY > 900` (animate out then `scheduleOnRN(onClose)`), else spring back. Bottom padding `28 + insets.bottom` (`react-native-safe-area-context`). "Done" pill as web.

**Icon** — `Svg viewBox="0 0 24 24"` with `Path`/`Circle`/`Line`/`Rect` elements transcribed from `../../node_modules/lucide-react/dist/esm/icons/*.mjs` (v1.14) into a typed `Record<IconName, ReactNode>` factory; `fill="none" stroke={color} strokeLinecap/Join="round"`.

**Verification** — `npx tsc --noEmit`, `npx vitest run`, `npx expo lint`; grep atoms for `#`/`rgb` literals (only the scrim allowed). Device check once the new dev build is installed (10/11 exercise the atoms).

## Result
Files: `src/components/Icon.tsx`, `src/components/atoms/{Dial,PulseRings,CentsRing,BeatColumn,SubdivisionCluster,HistoryStrip,Chip,BottomSheet}.tsx`, `atoms/svgGeometry.ts` + `svgGeometry.test.ts` (13 tests). `npx tsc --noEmit` clean, `npx vitest run` 188/188, `npx expo lint` 0 errors (the 2 warnings are in `useTuner.ts` / `display.test.ts`, not mine). Colour literals in atoms: only `'transparent'`; everything else from `useTheme()`. Code written against the theme stub (incl. `scrim`); nothing imports the atoms yet, so the running app is unaffected.

**As built, differences from Plan:** Dial accumulates wrapped deltas, so one drag can sweep the whole 270° (the web caps a single drag at ±180°). Dial knob = 2 animated circles (the web's rotate transform is a no-op on circles). PulseRings uses one progress shared value per pooled ring (scale .42→1.32, opacity = base × .8 × (1−p)) instead of separate values. Beat/subdivision 80 ms changes use Reanimated 4 CSS transitions (`transitionProperty`/`transitionDuration`) on `Animated.View`/`Animated.Text`. Shared values use `.get()/.set()` (React Compiler friendly). RN 0.88 removed `StyleSheet.absoluteFillObject`; atoms spell out `top/right/bottom/left: 0`, and `pointerEvents` is a style prop.

**Babel:** confirmed. `babel-preset-expo` 58.0.24 (`build/configs/expo.js` L104-116) auto-adds `react-native-worklets/plugin` when the package resolves (falls back to the reanimated plugin), so no `babel.config.js` is needed. The worklets plugin also knows the RNGH 3 hook names (`usePanGesture`…), and the callbacks carry explicit `'worklet'` directives anyway.

**Check on the phone (new dev build):**
1. CentsRing text y-offsets (fontSize·0.35 instead of `dominantBaseline`): −25/0/+25 labels inside the ring, ±50¢ labels outside the ends, the big note letter (y = c+12+31), the accidental next to it (x c+32), `OCT n` under it, ♭/♯ at the ring's sides.
2. Dial scale numbers (5 labels) centred on their radius, not sitting high/low.
3. Display font (Fraunces light) on the 88 px note with `letterSpacing −4.4`: check it isn't clipped or overlapping the accidental.
4. Dial drag: knob follows the finger, BPM steps once per integer, haptic tick each step, no jump when crossing 6 o'clock, taps on the centre time-signature button still work, dial vs ScrollView.
5. PulseRings: rings sync to beats at 240 BPM (pool of 4, max ~4 rings live at once), accent ring thicker and longer.
6. BottomSheet: slide-up/fade timing, swipe-down dismiss (slow past 25% and a fast flick), backdrop tap, Android back, bottom inset with gesture nav, sheet over the tab bar, status bar not dimmed oddly (`statusBarTranslucent`).
7. Chip press scale; icons inside an active Chip turn `bg` colour.
8. BeatColumn: the accent bar is easy to hit (hitSlop top 12 / bottom 8), current beat colour changes stay crisp at high BPM (80 ms transitions).
