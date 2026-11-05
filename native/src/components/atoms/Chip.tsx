import { Children, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useTheme } from '../../theme'
import { IconColorContext } from '../Icon'

export type ChipProps = {
  active?: boolean
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  testID?: string
}

const PRESS_MS = 90

export function Chip({
  active = false,
  children,
  onPress,
  disabled,
  style,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const { colors, fonts } = useTheme()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))

  const textColor = active ? colors.bg : colors.fgDim
  const content = Children.map(children, (child) =>
    typeof child === 'string' || typeof child === 'number' ? (
      <Text style={[styles.label, { color: textColor, fontFamily: fonts.sans.medium }]}>
        {child}
      </Text>
    ) : (
      child
    ),
  )

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        scale.set(withTiming(0.97, { duration: PRESS_MS }))
      }}
      onPressOut={() => {
        scale.set(withTiming(1, { duration: PRESS_MS }))
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={style}
    >
      <Animated.View
        style={[
          styles.chip,
          {
            backgroundColor: active ? colors.fg : 'transparent',
            borderColor: active ? colors.fg : colors.borderStrong,
            opacity: disabled ? 0.5 : 1,
          },
          animatedStyle,
        ]}
      >
        <IconColorContext.Provider value={textColor}>{content}</IconColorContext.Provider>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.22,
  },
})
