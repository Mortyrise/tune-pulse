import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { type CSSTransitionProperties } from 'react-native-reanimated'
import type { Subdivision } from '../../audio/metronomeLayout'
import { useTheme } from '../../theme'
import { SubdivisionCluster } from './SubdivisionCluster'

export type BeatColumnProps = {
  beat: number
  isAccent: boolean
  subdivision: Subdivision
  currentBeat: number
  currentSub: number
  isRunning: boolean
  inCountIn: boolean
  onToggleAccent: () => void
  onCycleSubdivision: () => void
}

const BAR_TRANSITION: CSSTransitionProperties<ViewStyle> = {
  transitionProperty: ['backgroundColor', 'borderColor'],
  transitionDuration: 80,
  transitionTimingFunction: 'ease',
}
const TEXT_TRANSITION: CSSTransitionProperties<TextStyle> = {
  transitionProperty: 'color',
  transitionDuration: 80,
  transitionTimingFunction: 'ease',
}

export function BeatColumn({
  beat,
  isAccent,
  subdivision,
  currentBeat,
  currentSub,
  isRunning,
  inCountIn,
  onToggleAccent,
  onCycleSubdivision,
}: BeatColumnProps) {
  const { colors, fonts } = useTheme()
  const isCurrent = isRunning && beat === currentBeat && !inCountIn

  const accentBackground = isAccent
    ? isCurrent
      ? colors.accent
      : colors.fg
    : isCurrent
      ? colors.accentSoft
      : 'transparent'

  return (
    <View style={styles.column}>
      <Pressable
        onPress={onToggleAccent}
        hitSlop={{ top: 12, bottom: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Toggle accent on beat ${beat}`}
        accessibilityState={{ selected: isAccent }}
        style={styles.accentHit}
      >
        <Animated.View
          style={[
            styles.accentBar,
            {
              backgroundColor: accentBackground,
              borderColor: isAccent ? 'transparent' : colors.borderStrong,
            },
            BAR_TRANSITION,
          ]}
        />
      </Pressable>
      <Animated.Text
        style={[
          styles.beatNumber,
          { color: isCurrent ? colors.accent : colors.muted, fontFamily: fonts.mono.medium },
          TEXT_TRANSITION,
        ]}
      >
        {beat}
      </Animated.Text>
      <Pressable
        onPress={onCycleSubdivision}
        accessibilityRole="button"
        accessibilityLabel={`Cycle subdivision for beat ${beat}`}
        style={[styles.subBox, { backgroundColor: colors.paper, borderColor: colors.border }]}
      >
        <SubdivisionCluster count={subdivision} isActive={isCurrent} subIndex={currentSub} />
        <Text style={[styles.subLabel, { color: colors.muted, fontFamily: fonts.mono.regular }]}>
          ×{subdivision}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  column: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  accentHit: { width: '100%', maxWidth: 30 },
  accentBar: {
    height: 11,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  beatNumber: { fontSize: 11, fontVariant: ['tabular-nums'] },
  subBox: {
    minWidth: 36,
    alignItems: 'center',
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  subLabel: { fontSize: 8.5, letterSpacing: 0.34 },
})
