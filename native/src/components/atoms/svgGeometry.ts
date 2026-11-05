// Pure geometry helpers shared by the SVG atoms. Every function is a worklet so
// gesture / animated-props code on the UI thread can call it; they also run
// fine as plain JS (vitest, render).

export type Point = { x: number; y: number }

export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): Point {
  'worklet'
  const a = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

export function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = Math.abs(endAngle - startAngle) <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

// --- Dial ---------------------------------------------------------------------

/** Total sweep of the dial scale, in degrees. */
export const DIAL_SWEEP = 270
/** Angle of `min`, clockwise from 12 o'clock. */
export const DIAL_START = -135

/** Angle of a point around (cx, cy), clockwise from 12 o'clock, in -180..180. */
export function dialAngleFromPoint(x: number, y: number, cx: number, cy: number): number {
  'worklet'
  return (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI
}

/** Wraps an angle difference into -180..180 so crossing 6 o'clock doesn't jump. */
export function wrapDelta(deg: number): number {
  'worklet'
  let d = deg % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export function clampValue(value: number, min: number, max: number): number {
  'worklet'
  return Math.max(min, Math.min(max, value))
}

/** Value after rotating `deltaDeg` from `startValue` (rounded, clamped). */
export function dialValueFromDrag(
  startValue: number,
  deltaDeg: number,
  min: number,
  max: number,
): number {
  'worklet'
  return clampValue(Math.round(startValue + (deltaDeg / DIAL_SWEEP) * (max - min)), min, max)
}

/** Unrounded value for a drag, used to move the knob smoothly between steps. */
export function dialRawValueFromDrag(
  startValue: number,
  deltaDeg: number,
  min: number,
  max: number,
): number {
  'worklet'
  return clampValue(startValue + (deltaDeg / DIAL_SWEEP) * (max - min), min, max)
}

/** Knob angle (clockwise from 12 o'clock) for a value. */
export function valueToDialAngle(value: number, min: number, max: number): number {
  'worklet'
  const span = max - min
  const percent = span === 0 ? 0 : (clampValue(value, min, max) - min) / span
  return DIAL_START + percent * DIAL_SWEEP
}

/** Point at `angleDeg` measured clockwise from 12 o'clock (the dial's convention). */
export function dialPoint(cx: number, cy: number, r: number, angleDeg: number): Point {
  'worklet'
  const a = (angleDeg * Math.PI) / 180
  return { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r }
}

// --- Cents --------------------------------------------------------------------

export type Tone = 'good' | 'warn' | 'bad'

export const DEFAULT_IN_TUNE_CENTS = 5

/** good ≤ inTuneCents, warn ≤ 3 × inTuneCents, else bad (web: 5 / 15). */
export function centsTone(cents: number, inTuneCents: number = DEFAULT_IN_TUNE_CENTS): Tone {
  'worklet'
  const abs = Math.abs(cents)
  if (abs <= inTuneCents) return 'good'
  if (abs <= inTuneCents * 3) return 'warn'
  return 'bad'
}

export const CENTS_RANGE = 50
/** Ring angle (standard SVG degrees, -90 = top) for a cents offset; ±50¢ → ±90°. */
export function centsToRingAngle(cents: number): number {
  'worklet'
  const clamped = clampValue(cents, -CENTS_RANGE, CENTS_RANGE)
  return (clamped / CENTS_RANGE) * 90 - 90
}

/** Half-widths (deg) of the green in-tune and amber near bands; 9.6° / 27° at 5¢. */
export function toleranceBands(inTuneCents: number = DEFAULT_IN_TUNE_CENTS): {
  inTuneDeg: number
  nearDeg: number
} {
  const k = inTuneCents / DEFAULT_IN_TUNE_CENTS
  return { inTuneDeg: Math.min(90, 9.6 * k), nearDeg: Math.min(90, 27 * k) }
}
