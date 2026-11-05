import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Defs, Line, RadialGradient, Stop, Text as SvgText } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'
import { useTheme } from '../../theme'
import {
  DIAL_START,
  DIAL_SWEEP,
  clampValue,
  dialAngleFromPoint,
  dialPoint,
  dialRawValueFromDrag,
  valueToDialAngle,
  wrapDelta,
} from './svgGeometry'

const TICK_COUNT = 60
const SNAP_MS = 80
/** Pan activates after this much movement, so taps on children never start a drag. */
const DRAG_SLOP = 4

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export type DialProps = {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  size?: number
  isRunning?: boolean
  /** Selection haptic on every integer step while dragging. Default true. */
  haptics?: boolean
  /** Centred overlay; Pressables inside stay tappable. */
  children?: ReactNode
}

export function Dial({
  value,
  min,
  max,
  onChange,
  size = 270,
  isRunning,
  haptics = true,
  children,
}: DialProps) {
  const { colors, fonts } = useTheme()
  const glowId = `dial-glow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const c = size / 2
  const percent = max === min ? 0 : (clampValue(value, min, max) - min) / (max - min)

  // Latest callback / options for the JS-side emitter (refs written in an effect).
  const emitRef = useRef({ onChange, haptics })
  useEffect(() => {
    emitRef.current = { onChange, haptics }
  }, [onChange, haptics])
  const emit = useMemo(
    () => (next: number) => {
      const { onChange: cb, haptics: buzz } = emitRef.current
      cb(next)
      if (buzz) Haptics.selectionAsync().catch(() => {})
    },
    [],
  )

  // UI-thread state.
  const knobAngle = useSharedValue(valueToDialAngle(value, min, max))
  const range = useSharedValue({ min, max, value })
  const dragging = useSharedValue(false)
  const drag = useSharedValue({ prevAngle: 0, accum: 0, startValue: 0, lastEmitted: 0 })

  useEffect(() => {
    range.set({ min, max, value })
    if (!dragging.get()) {
      knobAngle.set(withTiming(valueToDialAngle(value, min, max), { duration: SNAP_MS }))
    }
  }, [value, min, max, range, dragging, knobAngle])

  const pan = usePanGesture({
    minDistance: DRAG_SLOP,
    onBegin: (e) => {
      'worklet'
      const r = range.get()
      drag.set({
        prevAngle: dialAngleFromPoint(e.x, e.y, c, c),
        accum: 0,
        startValue: r.value,
        lastEmitted: r.value,
      })
    },
    onActivate: () => {
      'worklet'
      dragging.set(true)
    },
    onUpdate: (e) => {
      'worklet'
      const r = range.get()
      const d = drag.get()
      const angle = dialAngleFromPoint(e.x, e.y, c, c)
      const accum = d.accum + wrapDelta(angle - d.prevAngle)
      const raw = dialRawValueFromDrag(d.startValue, accum, r.min, r.max)
      knobAngle.set(valueToDialAngle(raw, r.min, r.max))
      const next = Math.round(raw)
      drag.set({ prevAngle: angle, accum, startValue: d.startValue, lastEmitted: next })
      if (next !== d.lastEmitted) {
        scheduleOnRN(emit, next)
      }
    },
    onFinalize: () => {
      'worklet'
      if (!dragging.get()) return
      dragging.set(false)
      const r = range.get()
      const settled = drag.get().lastEmitted
      knobAngle.set(withTiming(valueToDialAngle(settled, r.min, r.max), { duration: SNAP_MS }))
    },
  })

  const knobProps = useAnimatedProps(() => {
    const p = dialPoint(c, c, size / 2 - 9, knobAngle.get())
    return { cx: p.x, cy: p.y }
  })

  const geometry = useMemo(() => {
    const ticks = []
    const labels = []
    for (let i = 0; i < TICK_COUNT; i++) {
      const t = i / (TICK_COUNT - 1)
      const angle = DIAL_START + t * DIAL_SWEEP
      const isMajor = i % 10 === 0
      const inner = dialPoint(c, c, size / 2 - (isMajor ? 14 : 10), angle)
      const outer = dialPoint(c, c, size / 2 - (isMajor ? 4 : 6), angle)
      ticks.push({ i, t, isMajor, inner, outer })
      if (isMajor && i > 0 && i < TICK_COUNT - 1) {
        labels.push({
          i,
          value: Math.round(min + t * (max - min)),
          at: dialPoint(c, c, size / 2 - 24, angle),
        })
      }
    }
    return { ticks, labels }
  }, [c, size, min, max])

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: size, height: size }}>
        {/* Scale layer carries the a11y slider so overlay children stay reachable. */}
        <View
          style={styles.fill}
          accessible
          accessibilityRole="adjustable"
          accessibilityValue={{ min, max, now: value }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const step = e.nativeEvent.actionName === 'increment' ? 1 : -1
            onChange(clampValue(value + step, min, max))
          }}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Defs>
              <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
                <Stop offset="55%" stopColor={colors.accent} stopOpacity={0.06} />
                <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {isRunning && <Circle cx={c} cy={c} r={size / 2 - 16} fill={`url(#${glowId})`} />}
            {geometry.ticks.map(({ i, t, isMajor, inner, outer }) => {
              const isActive = t <= percent
              return (
                <Line
                  key={i}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke={isActive ? colors.accent : colors.borderStrong}
                  strokeWidth={isMajor ? 1.5 : 1}
                  strokeLinecap="round"
                  opacity={isActive ? (isMajor ? 1 : 0.85) : 0.55}
                />
              )
            })}
            {geometry.labels.map(({ i, value: label, at }) => (
              <SvgText
                key={`label-${i}`}
                x={at.x}
                y={at.y + 9 * 0.35}
                textAnchor="middle"
                fontFamily={fonts.mono.regular}
                fontSize={9}
                fill={colors.muted}
                opacity={0.7}
              >
                {String(label)}
              </SvgText>
            ))}
            <AnimatedCircle
              animatedProps={knobProps}
              r={8}
              fill={colors.accent}
              fillOpacity={0.18}
            />
            <AnimatedCircle animatedProps={knobProps} r={3.5} fill={colors.accent} />
          </Svg>
        </View>
        <View style={[styles.fill, styles.overlay]}>{children}</View>
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  overlay: { alignItems: 'center', justifyContent: 'center', pointerEvents: 'box-none' },
})
