import { useEffect, useMemo } from 'react'
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useTheme } from '../../theme'
import {
  CENTS_RANGE,
  centsToRingAngle,
  centsTone,
  DEFAULT_IN_TUNE_CENTS,
  describeArc,
  polarToCartesian,
  toleranceBands,
} from './svgGeometry'

const TOP_CENTER_DEG = -90
const INDICATOR_MS = 180
const INDICATOR_EASE = Easing.inOut(Easing.ease)
/** react-native-svg ignores dominantBaseline on Android: shift by ~0.35em instead. */
const CENTRAL = 0.35

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

export type CentsRingProps = {
  cents: number
  active: boolean
  noteLabel: string | null
  /** Sharp/flat glyph next to the note ("♯", "♭", or undefined). */
  accidental?: string | null
  octave?: number | null
  size?: number
  /** 0..1 — fills a green confirmation arc when within tolerance over time. */
  holdProgress?: number
  /** Tolerance in cents: good ≤ inTuneCents, warn ≤ 3×; scales the bands. Default 5 (web). */
  inTuneCents?: number
}

export function CentsRing({
  cents,
  active,
  noteLabel,
  accidental,
  octave,
  size = 290,
  holdProgress = 0,
  inTuneCents = DEFAULT_IN_TUNE_CENTS,
}: CentsRingProps) {
  const { colors, fonts } = useTheme()
  const c = size / 2
  const radius = size / 2 - 26
  const color = active ? colors[centsTone(cents, inTuneCents)] : colors.muted
  const { inTuneDeg, nearDeg } = toleranceBands(inTuneCents)

  // Indicator angle animates on the UI thread; React only sets the target.
  const angle = useSharedValue(centsToRingAngle(cents))
  useEffect(() => {
    angle.set(
      withTiming(centsToRingAngle(cents), { duration: INDICATOR_MS, easing: INDICATOR_EASE }),
    )
  }, [cents, angle])

  const indicatorProps = useAnimatedProps(() => {
    const p = polarToCartesian(c, c, radius, angle.get())
    return { cx: p.x, cy: p.y }
  })
  const needleProps = useAnimatedProps(() => {
    const p = polarToCartesian(c, c, radius, angle.get())
    return { x2: p.x, y2: p.y }
  })

  const scale = useMemo(() => {
    const markers = [-25, 0, 25].map((mark) => {
      const a = (mark / CENTS_RANGE) * 90 + TOP_CENTER_DEG
      return {
        mark,
        label: polarToCartesian(c, c, radius - 14, a),
        inner: polarToCartesian(c, c, radius - 6, a),
        outer: polarToCartesian(c, c, radius + 4, a),
      }
    })
    const extremes = [-50, 50].map((mark) => ({
      mark,
      label: polarToCartesian(c, c, radius + 14, (mark / CENTS_RANGE) * 90 + TOP_CENTER_DEG),
    }))
    return { markers, extremes }
  }, [c, radius])

  const mono = fonts.mono.regular
  const display = fonts.display.light

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={radius} fill="none" stroke={colors.border} strokeWidth={1} />
      <Path
        d={describeArc(c, c, radius, -90, 90)}
        fill="none"
        stroke={colors.borderStrong}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d={describeArc(c, c, radius, TOP_CENTER_DEG - inTuneDeg, TOP_CENTER_DEG + inTuneDeg)}
        fill="none"
        stroke={colors.good}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.4}
      />
      <Path
        d={describeArc(c, c, radius, TOP_CENTER_DEG - nearDeg, TOP_CENTER_DEG + nearDeg)}
        fill="none"
        stroke={colors.warn}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.45}
      />

      {active && holdProgress > 0 && (
        <Path
          d={describeArc(
            c,
            c,
            radius,
            TOP_CENTER_DEG - holdProgress * 10,
            TOP_CENTER_DEG + holdProgress * 10,
          )}
          fill="none"
          stroke={colors.good}
          strokeWidth={6}
          strokeLinecap="round"
        />
      )}

      {scale.markers.map(({ mark, label, inner, outer }) => (
        <G key={mark}>
          <Line
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={colors.borderStrong}
            strokeWidth={1}
          />
          <SvgText
            x={label.x}
            y={label.y + 9 * CENTRAL}
            textAnchor="middle"
            fontFamily={mono}
            fontSize={9}
            fill={colors.muted}
          >
            {mark === 0 ? '0' : mark > 0 ? `+${mark}` : String(mark)}
          </SvgText>
        </G>
      ))}

      {scale.extremes.map(({ mark, label }) => (
        <SvgText
          key={mark}
          x={label.x}
          y={label.y + 9 * CENTRAL}
          textAnchor="middle"
          fontFamily={mono}
          fontSize={9}
          fill={colors.muted}
        >
          {mark > 0 ? `+${mark}¢` : `${mark}¢`}
        </SvgText>
      ))}

      <SvgText
        x={c - radius - 6}
        y={c + 4}
        textAnchor="end"
        fontFamily={mono}
        fontSize={11}
        fill={colors.muted}
        opacity={0.7}
      >
        ♭
      </SvgText>
      <SvgText
        x={c + radius + 6}
        y={c + 4}
        textAnchor="start"
        fontFamily={mono}
        fontSize={11}
        fill={colors.muted}
        opacity={0.7}
      >
        ♯
      </SvgText>

      {active && (
        <G>
          <AnimatedCircle animatedProps={indicatorProps} r={18} fill={color} fillOpacity={0.12} />
          <AnimatedCircle animatedProps={indicatorProps} r={8} fill={color} />
          <AnimatedLine
            animatedProps={needleProps}
            x1={c}
            y1={c + radius * 0.18}
            stroke={color}
            strokeWidth={1.2}
            strokeOpacity={0.4}
          />
        </G>
      )}

      <SvgText
        x={c}
        y={c + 12 + 88 * CENTRAL}
        textAnchor="middle"
        fontFamily={display}
        fontSize={88}
        letterSpacing={-4.4}
        fill={active ? colors.fg : colors.muted}
      >
        {noteLabel ?? '—'}
      </SvgText>
      {active && accidental ? (
        <SvgText
          x={c + 32}
          y={c - 6 + 34 * CENTRAL}
          textAnchor="start"
          fontFamily={display}
          fontSize={34}
          fill={colors.accent}
        >
          {accidental}
        </SvgText>
      ) : null}
      {octave !== null && octave !== undefined && (
        <SvgText
          x={c}
          y={c + 54}
          textAnchor="middle"
          fontFamily={mono}
          fontSize={11}
          letterSpacing={2}
          fill={colors.muted}
        >
          {`OCT ${octave}`}
        </SvgText>
      )}
    </Svg>
  )
}
