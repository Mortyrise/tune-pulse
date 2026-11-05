// `● PULSE·GROOVE` brand shown at the left of each screen's top bar. The dot
// pulses every `pulseMs` (default 2 s; the metronome passes 2 beats).
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useTheme } from '../theme'

export function BrandMark({ pulseMs = 2000 }: { pulseMs?: number }) {
  const { colors, fonts } = useTheme()
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.set(0)
    progress.set(withRepeat(withTiming(1, { duration: pulseMs / 2, easing: Easing.inOut(Easing.ease) }), -1, true))
    return () => cancelAnimation(progress)
  }, [pulseMs, progress])

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.5 * progress.get(),
    transform: [{ scale: 1 - 0.35 * progress.get() }],
  }))

  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="pulse groove">
      <Animated.View style={[styles.dot, { backgroundColor: colors.accent }, dotStyle]} />
      <Text style={[styles.text, { color: colors.muted, fontFamily: fonts.mono.medium }]}>pulse·groove</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 7, height: 7, borderRadius: 99 },
  text: { fontSize: 10.5, letterSpacing: 1.9, textTransform: 'uppercase' },
})
