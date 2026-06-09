# Handoff · pulseGroove UI redesign

> **Target repo:** `Mortyrise/tune-pulse` (Vite + React 19 + TypeScript + Tailwind v4 + react-router + vite-plugin-pwa).
> **Scope:** Replace the entire UI (screens + components + tokens) of the existing app with the redesign in this handoff. **Do not touch the audio engine** — keep `src/audio/`, `src/hooks/useMetronome.ts`, `src/hooks/useTuner.ts`, `src/hooks/useTapTempo.ts`, `src/hooks/useSavedPatterns.ts`, `src/lib/notes.ts` exactly as they are. The redesign **wires into these existing hooks** for state and pitch/beat data.

---

## About the design files

The contents of `prototypes/` are **design references created in HTML + Babel JSX**, not production code. They show the intended look, behaviour and component composition. Your job is to **recreate them in the target codebase** using its established stack:

- **React 19** (functional components + hooks)
- **TypeScript** (strict typing)
- **Tailwind v4** (the `@theme` block in `src/index.css`) — the current repo already uses CSS custom properties via `@theme`. **Extend that block with the new tokens below**, don't introduce a separate CSS file.
- **react-router** for navigation
- **lucide-react** for icons (the prototype draws its own SVGs; in the target use lucide equivalents)

## Fidelity

**High-fidelity.** Pixel-perfect mockups with final colors, typography, spacing, layout, and microcopy. Recreate verbatim. Where the prototype draws an SVG icon inline (e.g. `play`, `pause`, `mic`, `metronome`, `pulse`, `vibrate`, `volume`, `tap`, `bookmark`, `check`, `refresh`, `chevR/L`, `minus`, `plus`), substitute the closest **lucide-react** icon.

---

## What ships

### Two viewports, one codebase

The design is **responsive** — same components, different layouts at different breakpoints:

| Breakpoint            | Layout                         | Frame             |
|-----------------------|--------------------------------|-------------------|
| `< 900px` (mobile)    | Stacked tab-bar app (Tuner / Metronome) | PWA full-bleed   |
| `≥ 900px` (desktop)   | Dashboard — metronome + tuner side-by-side + grooves library + session rail | PWA full-bleed   |

Implement with Tailwind's `md:` / `lg:` breakpoints, or use a single `useMediaQuery('(min-width: 900px)')` hook + conditional render. The component tree differs significantly between the two — prefer **two top-level screen components** sharing the same atoms (Dial, PulseRings, CentsRing, BeatColumn, HistoryStrip, Chip, etc.) than a single component that branches everywhere.

---

## Design tokens

Add these to the existing `@theme` block in `src/index.css`. The three themes live as `[data-theme="..."]` attribute selectors on the root.

```css
@theme {
  /* LIGHT (default) — editorial cream */
  --color-bg: #EEE7D6;
  --color-paper: #FAF5E5;
  --color-paper-deep: #E4DCC4;
  --color-fg: #181816;
  --color-fg-dim: #3A382F;
  --color-muted: #8A867A;
  --color-border: rgba(24,24,22,0.08);
  --color-border-strong: rgba(24,24,22,0.15);

  --color-accent: #C4502F;      /* burnt coral */
  --color-accent-deep: #9B3A1C;
  --color-accent-soft: rgba(196,80,47,0.12);
  --color-warn: #D49A2B;
  --color-bad: #B83A2A;
  --color-good: #4A7C3A;        /* moss green — in-tune */

  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;
  --font-display: 'Fraunces', serif;
}

[data-theme="dark"] {
  --color-bg: #0F0E0C;
  --color-paper: #1A1815;
  --color-paper-deep: #131210;
  --color-fg: #F4EFE2;
  --color-fg-dim: #C6BFAE;
  --color-muted: #807968;
  --color-border: rgba(244,239,226,0.07);
  --color-border-strong: rgba(244,239,226,0.14);
  --color-accent: #E26A3F;
  --color-accent-deep: #B7522D;
  --color-accent-soft: rgba(226,106,63,0.16);
  --color-warn: #E4B547;
  --color-bad: #E26452;
  --color-good: #7BB070;
}

[data-theme="mono"] {
  --color-bg: #F4EFE2;
  --color-paper: #FBF7E9;
  --color-paper-deep: #ECE6D5;
  --color-fg: #100F0D;
  --color-fg-dim: #2A2924;
  --color-muted: #7E7B70;
  --color-border: rgba(16,15,13,0.08);
  --color-border-strong: rgba(16,15,13,0.18);
  --color-accent: #100F0D;
  --color-accent-soft: rgba(16,15,13,0.08);
  --color-warn: #8C7228;
  --color-bad: #8C3A2A;
  --color-good: #325A26;
}
```

Load fonts from Google Fonts via `<link>` in `index.html`:
```
Inter (300–700) · JetBrains Mono (300–600) · Fraunces (ital, opsz 9..144, wght 300..600)
```

The existing `useTheme.ts` already wires `data-theme` to the `<html>` element — extend it to support `'light' | 'dark' | 'mono'`.

---

## Mobile screens

### Tab bar (persistent, bottom)
- 2 tabs: **Tuner** (`/`) and **Metronome** (`/metronome`)
- Active tab background `var(--color-bg)`, inactive transparent + muted text
- Tab text 12px Inter 600, letter-spacing 0.02em
- Icons 15px lucide (`AudioWaveform` for Tuner, `Timer` for Metronome — already what the repo uses)

### Metronome screen — `screens/MetronomeScreen.tsx`

Layout top → bottom, spacious density (24px horizontal padding, 16px gaps):

1. **Top bar** — `pulse·groove` brand + `METRONOME` label
2. **Tempo character** — italic Fraunces 22px (e.g. *Andante*) + mono 10px descriptor (*Walking pace*). The mapping table:

   | BPM ≤ | Name | Meaning |
   |-------|------|---------|
   | 40 | Grave | Solemn · very slow |
   | 60 | Largo | Broad · slow |
   | 66 | Larghetto | Rather broad |
   | 76 | Adagio | At ease |
   | 108 | Andante | Walking pace |
   | 120 | Moderato | Moderate |
   | 156 | Allegro | Lively · quick |
   | 176 | Vivace | Brisk · lively |
   | 200 | Presto | Very fast |
   | ∞ | Prestissimo | Extremely fast |

3. **Dial hero** (260px circle) — **THE BPM and its control are the same object**:
   - Tick ring around the circumference (60 ticks, every 10th is major). Active arc filled in accent, inactive in `--border-strong`.
   - Major-tick labels at 60/95/130/165/200/235 in mono 9px muted.
   - Drag the ring → rotates value through full range (270° sweep, -135° → +135°).
   - Center: BPM number in **Fraunces 86px weight 300**, tabular nums, `-0.045em` letter-spacing.
   - Below: mono caption `BPM · DRAG` (10px, 0.22em).
   - Below that: time-signature chip `4/4 ♩` that opens a bottom sheet.
   - **PulseRings overlay**: on each beat, spawn an SVG circle at the dial center that scales from 0.42 → 1.32 over ~1000ms while fading. Accents are thicker (2px) and brighter (opacity 0.7 vs 0.4). Use `requestAnimationFrame` or CSS `@keyframes pg-ring-expand`. Sourced from the existing `BeatEvent` callback in `useMetronome.ts`.

4. **Bar pattern card** — the heart of the redesign. One column per beat. Each column has:
   - **Accent bar** (top): 30×11px rounded rect, tap toggles accent. Filled `--fg` when accented, accent color when current+accented, border otherwise.
   - **Beat number** (middle): mono 11px, accent color when current beat.
   - **Subdivision cluster** (bottom): rounded box 36×~40px showing N dots (1/2/3/4 = clicks per beat). Tap cycles 1 → 2 → 3 → 4 → 1. Dots light up in accent color when their slot is currently sounding. Below: `×N` label, mono 8.5px.

   The subdivisions array length must match `numerator`. The existing scheduler already supports `subdivisions: Subdivision[]` — see `src/audio/metronomeScheduler.ts`.

5. **Session strip** — bordered rounded box: `BAR 012 · 00:32` on the left, `● live` / `● count-in` / `○ idle` on the right. Mono 10.5px muted, bar number bold + fg color.

6. **Secondary chips row** — Tap tempo · Count-in · off/1 bar/2 bars · Audio/Haptic · Grooves. 30px pill buttons, hairline borders.

7. **Start groove** — full-width 58px button, accent bg, white text, uppercase 13px 0.18em tracking. When running becomes outlined `STOP`.

#### Saved Grooves (preset library)
Bottom sheet opens from "Grooves" chip. **List of 12 presets — copy verbatim from `prototypes/src/desktop/shared.jsx` `DESKTOP_GROOVES`** (Ballad, Backbeat, Half-time, Four-on-floor, Waltz, Shuffle, Bulería, 5/4 odd, 7/8 odd, Sixteenth grid, Samba, Dembow). Each has `name, bpm, n, d, accents, subs, hint, tag`. Apply by setting all five values on the metronome config at once.

The existing `useSavedPatterns.ts` handles user-saved patterns — keep that, and present the curated grooves as **a separate read-only "Library" section** above the user's saved ones.

### Tuner screen — `screens/TunerScreen.tsx`

Layout top → bottom, spacious density:

1. **Top bar** — brand + `CHROMATIC` label.
2. **Reference + clarity meta row** — `A4 · 440 Hz` (tappable, opens reference picker) on left; `clarity 92%` + (when in tune ≥1.5s) green `✓ IN TUNE` badge on right. Mono 10.5px.
3. **Cents Ring** (290px) — the centrepiece:
   - Hairline circle, then a 2.5px arc at the top half (`-90° → +90°`).
   - Sweet zone: thicker green arc near `-90°` (a few degrees wide).
   - Markers at `-25 / 0 / +25` (mono 9px muted) inside the arc; extreme labels `-50¢ / +50¢` outside.
   - Direction hints: `♭` left, `♯` right (outside the ring, muted 11px).
   - **Orbiting indicator**: a colored dot (green ≤5¢, amber ≤15¢, red beyond) at `angle = (cents/50) * 90° - 90°` on the radius. Add a soft 12% color circle behind it (r=14) and a faint line back to center.
   - **Hold-progress arc**: when within ±5¢, grow a thick green arc symmetrically around `-90°` over 1500ms. Confirms = "in tune" badge.
   - **Center**: Fraunces 88px note letter; super-script `♯` in accent if sharp; `OCT 3` caption below in mono 11px.
4. **Narrative + Hz row**:
   - Left: cents value `-2.0¢` Mono 28px in semantic color + narrative microcopy below:
     - `\|cents\| ≤ 5` → "In tune"
     - `≤ 12 sharp` → "Sharp · ease back"
     - `≤ 12 flat`  → "Flat · push up"
     - `≤ 30 sharp/flat` → "Sharp — keep loosening" / "Flat — keep tightening"
     - `> 30` → "Very sharp" / "Very flat"
   - Right: detected freq `219.75 Hz` mono 18px + `target 220.00 Hz` mono 10.5px.
5. **History strip** — `Recent · last 12` header, then a bordered 26px row split into 12 cells. Each cell shows a colored dot at vertical offset proportional to `cents/50` (green ≤5, amber ≤15, red beyond). Empty cells render a faint hairline dot.
6. **Instrument target card** — toggle `Chromatic / Guitar / Bass / Ukulele / Violin`. For chromatic: shows "Any pitch · 12 notes" + the detected note. For instrument tunings: row of string targets with the closest one highlighted in accent + cents/semitone delta.
   ```
   Guitar (EADGBE):     E2  A2  D3  G3  B3  E4   (MIDI 40,45,50,55,59,64)
   Bass   (EADG):       E1  A1  D2  G2          (MIDI 28,33,38,43)
   Ukulele(GCEA):       G4  C4  E4  A4          (MIDI 67,60,64,69)
   Violin (GDAE):       G3  D4  A4  E5          (MIDI 55,62,69,76)
   ```
7. **Footer row** — notation toggle (segmented `C–D–E` / `Do–Re–Mi`) + microphone-stop icon button.

#### Reference pitch sheet
Bottom sheet from the A4 button. Chips: `415, 432, 438, 440, 442, 444 Hz`. Brief explanation copy:
> *The frequency assigned to A above middle C. Most modern music uses 440 Hz; some European orchestras prefer 442, early-music ensembles 415.*

Setting changes `referenceA4` passed to `frequencyToNote()` in `src/lib/notes.ts` (extend its signature — it already accepts a `referenceA4` parameter).

#### States
- **idle** — centered 130px accent circle with pulsing ring + Fraunces 28px "Tap to listen" + mono 11px hint
- **starting** — same circle but spinner / "Listening…"
- **running** — the layout above
- **error** — micOff icon + title + body + "Try again" button. Three flavours from `useTuner.ts`: `denied`, `not-found`, `busy`. Copy from `prototypes/src/tuner.jsx` `ErrorView`.

---

## Desktop layout (≥900px) — Dashboard

3-column grid + top/bottom bar:

```
┌─────────────────────────────────────────────────────────────────┐
│ TOPBAR   pulse·groove · studio  ● idle BAR 000 · 00:00  A4 ⌘K   │
├──────────┬──────────────────────┬──────────────────────┬────────┤
│          │                      │                      │        │
│ GROOVES  │   METRONOME pane     │  TUNER pane          │ SESSION│
│ library  │                      │                      │ +stats │
│ +search  │   • Tempo · char     │   • Reading meta     │ +SHORT-│
│ +12 pre- │   • Big dial 460px   │   • CentsRing 460px  │ CUTS   │
│ sets     │   • Bar pattern card │   • Narrative+Hz card│        │
│          │                      │   • History strip    │        │
├──────────┴──────────────────────┴──────────────────────┴────────┤
│ BOTTOMBAR  Andante · Walking  4/4  accents on 1     Space + - T │
└─────────────────────────────────────────────────────────────────┘
   280px              ~680px               ~680px           280px
```

- Grid: `grid-template-columns: 280px 1fr 280px; grid-template-rows: 64px 1fr 56px`
- Both panes share **the exact same Dial, PulseRings, CentsRing, HistoryStrip, BeatColumn** atoms as mobile — just bigger sizes (`size={460}` vs `size={260}`).
- Grooves library sidebar has a sticky search input (border-radius 99px pill) and the same 12 preset list.
- Right rail stats: practice time, bars/BPM, detected note. Then a "Shortcuts" section with kbd-style chips.

### Keyboard shortcuts (desktop only)

| Key | Action |
|-----|--------|
| `Space` | Toggle metronome start/stop |
| `+` / `=` | BPM +1 |
| `-` / `_` | BPM -1 |
| `T` | Tap tempo |
| `M` | Focus metronome |
| `U` | Focus tuner |
| `⌘ K` | Search grooves (open library) |

Bind globally via `useEffect` on `window` keydown — but ignore events when target is `input` or `textarea`. See `useDesktopShortcuts` in `prototypes/src/desktop/shared.jsx`.

---

## Atoms (reusable components)

These are the building blocks. Implement once, use everywhere:

| Component | File reference | Notes |
|-----------|---------------|-------|
| `Dial` | `primitives.jsx` `Dial` | SVG ring with ticks + scale numbers + draggable indicator. Props: `value, min, max, onChange, size, isRunning, children` (centered overlay). Pointer events compute angle delta and map to value delta over `SWEEP = 270°`. |
| `PulseRings` | `primitives.jsx` `PulseRings` | Spawns expanding ring on each `tickId` change. Cleans up after 1200ms. |
| `CentsRing` | `primitives.jsx` `CentsRing` | SVG. All visual logic is in this file. |
| `BeatColumn` | `primitives.jsx` `BeatColumn` | Accent bar + beat number + subdivision cluster. Tap targets: top (accent), bottom (cycle). |
| `SubdivisionCluster` | `primitives.jsx` | Renders N dots, lights the active one. |
| `HistoryStrip` | `primitives.jsx` | 12-slot horizontal cent-trend. |
| `Icon` | `primitives.jsx` | Replace with lucide-react in the target. |
| `Chip` | inferred from `.pg-chip` in `styles.css` | 30px pill, hairline border, active state inverts fg/bg. |
| `BottomSheet` | `metronome.jsx` `BottomSheet` | Backdrop + sliding panel from bottom. |

---

## State & data wiring

The audio engine and hooks are already in the repo. **The redesign is purely a UI refresh** — re-use these as-is:

| Hook | What the UI needs from it |
|------|--------------------------|
| `useMetronome` | `config, isRunning, activeBeat, toggle, setBpm, setCountInBars, setNumerator, setDenominator, toggleAccent, setSubdivision, setHapticMode, applyConfig` — already matches what the new UI consumes. |
| `useTapTempo` | `tap()` from the tap-tempo chip. |
| `useSavedPatterns` | `patterns, save, remove` for user-saved grooves (below the curated Library section). |
| `useTuner` | `state, start, stop` — feed `state.sample` into the CentsRing and history. |
| `useTheme` | Extend to `'light' \| 'dark' \| 'mono'`. |

**Add two new bits of state that don't exist yet:**
- A **curated `GROOVES_LIBRARY` constant** in `src/lib/grooves.ts` (copy from prototype `DESKTOP_GROOVES`).
- A **reference-pitch setting** (default 440) — store in `useTheme`-like localStorage hook or a new `useReferenceA4`. Pipe into `frequencyToNote(freq, refA4)` calls.

### Demo cycle in the prototypes
The HTML prototypes simulate the tuner with a `DEMO_CYCLE` array because they have no mic access. **Remove all demo simulation in production** — the real `useTuner` hook provides live MPM pitch samples.

---

## Animations & micro-interactions

- **Pulse rings**: `@keyframes pg-ring-expand { 0% { transform: scale(.42); opacity: .8 } 100% { transform: scale(1.32); opacity: 0 } }` — duration 950ms normal / 1200ms accent.
- **Brand dot**: continuous pulse, 2s ease-in-out, scale 1 ↔ 0.65, opacity 1 ↔ 0.5. When metronome is running, **sync to half the beat period** (`animationDuration: ${period * 2}ms`).
- **Beat indicator** color/scale transition: 80ms ease.
- **Cents indicator** position: 180ms ease.
- **In-tune badge**: scale-up bounce `cubic-bezier(.2, 1.3, .4, 1)` 280ms.
- **Bottom sheets**: slide-up `cubic-bezier(.2, .9, .3, 1)` 220ms + fade-in backdrop 180ms.
- **Buttons / chips**: scale to 0.97 / 0.985 on active.

---

## Assets

- No bitmap assets. Everything is SVG (icons + the dial/ring viz) or CSS.
- Replace inline SVG icons with `lucide-react`:
  `play, pause, mic, micOff, minus, plus, refreshCw, vibrate, volume2, bookmarkPlus, chevronRight, chevronLeft, audioWaveform, timer, check`.
- Fonts via Google Fonts CDN (Inter / JetBrains Mono / Fraunces).

---

## File reference (in this bundle)

```
prototypes/
  pulseGroove.html              ← Open this in a browser to interact with the design.
  src/
    styles.css                  ← Source of truth for design tokens.
    primitives.jsx              ← Atoms — port to /src/components/ in the repo.
    metronome.jsx               ← Full Mobile metronome screen.
    tuner.jsx                   ← Full Mobile tuner screen + idle + error views.
    responsive-app.jsx          ← Top-level breakpoint switcher.
    ios-frame.jsx               ← (presentation-only — don't ship)
    tweaks-panel.jsx            ← (presentation-only — don't ship)
    desktop/
      desktop.css               ← Dashboard-specific layout tokens.
      shared.jsx                ← GROOVES_LIBRARY, tempo character, shortcuts, demo cycle.
      variant-dashboard.jsx     ← Desktop Dashboard layout.
      browser-window.jsx        ← (presentation-only — don't ship)
```

**Files marked "presentation-only"** are scaffolding for the design preview (iOS bezel, browser chrome, tweaks panel). The production app renders directly into the page — no frames.

---

## Acceptance checklist

- [ ] All three themes (`light` / `dark` / `mono`) work end-to-end via `[data-theme=…]` on `<html>`.
- [ ] Mobile and desktop share the same atom components — no duplicated logic.
- [ ] Metronome subdivision constructor (1/2/3/4 per beat) writes through to `MetronomeConfig.beats.subdivisions` and audibly changes the click pattern.
- [ ] Tuner cents ring + history + hold-to-confirm + reference selector all feed from the real `useTuner` hook.
- [ ] Curated `GROOVES_LIBRARY` (12 grooves) loads patterns into the metronome.
- [ ] Keyboard shortcuts work on desktop only (or at least no crashes on mobile).
- [ ] No layout breaks at `320px` width or at `1920px`. Breakpoint at `900px`.
- [ ] No reliance on the prototype's demo cycles or fake state — live audio drives everything.
