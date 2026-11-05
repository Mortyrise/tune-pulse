// `✓ IN TUNE` pill; pops in (scale .5 → 1, 280 ms, overshoot curve) each time it mounts.
import { useEffect } from 'react'
import { StyleSheet, Text } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Icon } from '../components/Icon'
import { useTheme } from '../theme'

const POP_MS = 280
const POP_EASE = Easing.bezier(0.2, 1.3, 0.4, 1)

export function InTuneBadge() {
  const { colors, fonts } = useTheme()
  const p = useSharedValue(0)
  useEffect(() => {
    p.set(withTiming(1, { duration: POP_MS, easing: POP_EASE }))
  }, [p])
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.get()),
    transform: [{ scale: 0.5 + 0.5 * p.get() }],
  }))
  return (
    <Animated.View style={[styles.badge, { backgroundColor: colors.good }, style]} accessibilityLabel="In tune">
      <Icon name="check" size={11} strokeWidth={2.2} color={colors.bg} />
      <Text style={[styles.text, { color: colors.bg, fontFamily: fonts.sans.semibold }]}>IN TUNE</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 99,
  },
  text: { fontSize: 10, letterSpacing: 1.2 },
})
