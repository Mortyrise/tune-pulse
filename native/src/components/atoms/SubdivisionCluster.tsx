import { StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, { type CSSTransitionProperties } from 'react-native-reanimated'
import type { Subdivision } from '../../audio/metronomeLayout'
import { useTheme } from '../../theme'

export type SubdivisionClusterProps = {
  count: Subdivision
  isActive: boolean
  subIndex: number
}

/** 80 ms ease, run by Reanimated's CSS transitions on the UI thread. */
const DOT_TRANSITION: CSSTransitionProperties<ViewStyle> = {
  transitionProperty: ['backgroundColor', 'opacity', 'transform'],
  transitionDuration: 80,
  transitionTimingFunction: 'ease',
}

export function SubdivisionCluster({ count, isActive, subIndex }: SubdivisionClusterProps) {
  const { colors } = useTheme()
  const dots = []
  for (let i = 0; i < count; i++) {
    const lit = isActive && subIndex === i
    dots.push(
      <Animated.View
        key={i}
        style={[
          styles.dot,
          {
            backgroundColor: lit ? colors.accent : colors.fgDim,
            opacity: lit ? 1 : count === 1 ? 0.9 : 0.55,
            transform: [{ scale: lit ? 1.4 : 1 }],
          },
          DOT_TRANSITION,
        ]}
      />,
    )
  }
  return <View style={styles.row}>{dots}</View>
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 8,
  },
  dot: { width: 3.5, height: 3.5, borderRadius: 1.75 },
})
