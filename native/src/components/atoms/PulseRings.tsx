import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useTheme } from '../../theme'

const ACCENT_DURATION_MS = 1200
const REGULAR_DURATION_MS = 950
const START_SCALE = 0.42
const END_SCALE = 1.32
const START_OPACITY = 0.8
const EASE = Easing.bezier(0.16, 1, 0.3, 1)
const POOL = 4

export type PulseRingsProps = {
  /** Increments every beat. Re-render with same value won't trigger a new ring. */
  tickId: number | null
  isRunning: boolean
  isAccent: boolean
  size?: number
}

type RingState = { progress: SharedValue<number>; accent: SharedValue<number> }

function Ring({ ring, size, color }: { ring: RingState; size: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = ring.progress.get()
    const accent = ring.accent.get() === 1
    return {
      borderWidth: accent ? 2 : 1,
      // Web: element opacity (.7 / .4) × keyframe opacity (.8 → 0).
      opacity: (accent ? 0.7 : 0.4) * START_OPACITY * (1 - p),
      transform: [{ scale: START_SCALE + (END_SCALE - START_SCALE) * p }],
    }
  })
  return (
    <Animated.View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
        style,
      ]}
    />
  )
}

/** Fixed pool of rings recycled round-robin: no React state per beat. */
export function PulseRings({ tickId, isRunning, isAccent, size = 260 }: PulseRingsProps) {
  const { colors } = useTheme()
  const p0 = useSharedValue(1)
  const p1 = useSharedValue(1)
  const p2 = useSharedValue(1)
  const p3 = useSharedValue(1)
  const a0 = useSharedValue(0)
  const a1 = useSharedValue(0)
  const a2 = useSharedValue(0)
  const a3 = useSharedValue(0)
  const rings = useMemo<RingState[]>(
    () => [
      { progress: p0, accent: a0 },
      { progress: p1, accent: a1 },
      { progress: p2, accent: a2 },
      { progress: p3, accent: a3 },
    ],
    [p0, p1, p2, p3, a0, a1, a2, a3],
  )
  const next = useRef(0)
  const lastTick = useRef(tickId)

  useEffect(() => {
    if (tickId === lastTick.current) return
    lastTick.current = tickId
    if (!isRunning || tickId === null) return
    const ring = rings[next.current]
    next.current = (next.current + 1) % POOL
    ring.accent.set(isAccent ? 1 : 0)
    ring.progress.set(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, {
          duration: isAccent ? ACCENT_DURATION_MS : REGULAR_DURATION_MS,
          easing: EASE,
        }),
      ),
    )
  }, [tickId, isRunning, isAccent, rings])

  return (
    <View style={styles.root}>
      {rings.map((ring, i) => (
        <Ring key={i} ring={ring} size={size} color={colors.accent} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  ring: { position: 'absolute' },
})
