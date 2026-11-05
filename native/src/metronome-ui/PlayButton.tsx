import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Icon } from '../components/Icon'
import { useTheme } from '../theme'

const PRESS_MS = 90

/** Full-width 58 px `START GROOVE`; outlined `STOP` while running. */
export function PlayButton({ isRunning, onPress }: { isRunning: boolean; onPress: () => void }) {
  const { colors, fonts, mode } = useTheme()
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))
  // Web uses white on the accent; the closest token that stays light in every theme.
  const onAccent = mode === 'dark' ? colors.fg : colors.paper
  const fg = isRunning ? colors.fg : onAccent
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.set(withTiming(0.985, { duration: PRESS_MS }))
      }}
      onPressOut={() => {
        scale.set(withTiming(1, { duration: PRESS_MS }))
      }}
      accessibilityRole="button"
      accessibilityLabel={isRunning ? 'Stop metronome' : 'Start metronome'}
    >
      <Animated.View
        style={[
          styles.button,
          isRunning
            ? { backgroundColor: 'transparent', borderColor: colors.borderStrong }
            : { backgroundColor: colors.accent, borderColor: colors.accent },
          animated,
        ]}
      >
        <Icon name={isRunning ? 'pause' : 'play'} size={14} color={fg} fill />
        <Text style={[styles.label, { color: fg, fontFamily: fonts.sans.semibold }]}>
          {isRunning ? 'Stop' : 'Start groove'}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: { fontSize: 13, letterSpacing: 2.3, textTransform: 'uppercase' },
})
