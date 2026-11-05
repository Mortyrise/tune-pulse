// Tuner chrome shared by every state (top bar) + the idle/starting and error views.
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { BrandMark } from '../components/BrandMark'
import { Icon } from '../components/Icon'
import { Chip } from '../components/atoms/Chip'
import { useTheme } from '../theme'
import type { ErrorCopy } from './format'

const DEBUG_LONG_PRESS_MS = 600
const IDLE_RING_MS = 1900

export function TunerTopBar({
  label,
  onSettings,
  onLongPressLabel,
}: {
  label: string
  onSettings: () => void
  /** Hidden debug toggle (long-press the section label). */
  onLongPressLabel?: () => void
}) {
  const { colors, fonts } = useTheme()
  return (
    <View style={styles.topbar}>
      <BrandMark />
      <View style={styles.topRight}>
        <Pressable
          onLongPress={onLongPressLabel}
          delayLongPress={DEBUG_LONG_PRESS_MS}
          hitSlop={8}
          accessibilityHint="Long-press to toggle tuner diagnostics"
        >
          <Text style={[styles.sectionLabel, { color: colors.muted, fontFamily: fonts.sans.semibold }]}>
            {label}
          </Text>
        </Pressable>
        <Pressable onPress={onSettings} hitSlop={10} accessibilityRole="button" accessibilityLabel="Open settings">
          <Icon name="settings" size={14} strokeWidth={1.6} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  )
}

export function TunerIdleView({
  starting,
  disabled,
  hint,
  onStart,
}: {
  starting: boolean
  disabled: boolean
  hint: string
  onStart: () => void
}) {
  const { colors, fonts } = useTheme()
  const ring = useSharedValue(0)

  useEffect(() => {
    if (starting) {
      cancelAnimation(ring)
      ring.set(withTiming(0, { duration: 200 }))
      return
    }
    ring.set(0)
    ring.set(withRepeat(withTiming(1, { duration: IDLE_RING_MS, easing: Easing.out(Easing.ease) }), -1, false))
    return () => cancelAnimation(ring)
  }, [starting, ring])

  // Same curve as the web `pg-ring-expand` (scale .42 → 1.32, fade out) on a 150 px ring.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - ring.get()),
    transform: [{ scale: 0.86 + 0.5 * ring.get() }],
  }))

  return (
    <View style={styles.center}>
      <Pressable
        onPress={onStart}
        disabled={starting || disabled}
        accessibilityRole="button"
        accessibilityLabel={starting ? 'Starting tuner' : 'Start tuner'}
        style={styles.micWrap}
      >
        <Animated.View style={[styles.micRing, { borderColor: colors.accent }, ringStyle]} />
        <View
          style={[
            styles.mic,
            { backgroundColor: colors.accent, boxShadow: `0 16px 48px ${colors.accentSoft}`, opacity: disabled ? 0.6 : 1 },
          ]}
        >
          <Icon name="mic" size={46} strokeWidth={1.4} color={colors.bg} />
        </View>
      </Pressable>
      <View style={styles.centerText}>
        <Text style={[styles.display, { color: colors.fg, fontFamily: fonts.display.regular }]}>
          {starting ? 'Listening…' : 'Tap to listen'}
        </Text>
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fonts.mono.regular }]}>{hint}</Text>
      </View>
    </View>
  )
}

export function TunerErrorView({
  copy,
  onRetry,
  onOpenSettings,
  onBack,
}: {
  copy: ErrorCopy
  onRetry: () => void
  onOpenSettings: () => void
  onBack: () => void
}) {
  const { colors, fonts } = useTheme()
  return (
    <View style={styles.center}>
      <View style={[styles.errIcon, { backgroundColor: colors.paper, borderColor: colors.borderStrong }]}>
        <Icon name="micOff" size={34} strokeWidth={1.4} color={colors.bad} />
      </View>
      <View style={styles.centerText}>
        <Text style={[styles.errTitle, { color: colors.fg, fontFamily: fonts.display.semibold }]}>{copy.title}</Text>
        <Text style={[styles.errBody, { color: colors.muted, fontFamily: fonts.sans.regular }]}>{copy.body}</Text>
      </View>
      <View style={styles.errActions}>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={[styles.pill, { backgroundColor: colors.fg }]}
        >
          <Icon name="refreshCw" size={13} strokeWidth={1.8} color={colors.bg} />
          <Text style={[styles.pillText, { color: colors.bg, fontFamily: fonts.sans.medium }]}>TRY AGAIN</Text>
        </Pressable>
        {copy.canOpenSettings ? (
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            style={[styles.pill, { borderColor: colors.borderStrong, borderWidth: StyleSheet.hairlineWidth }]}
          >
            <Icon name="settings" size={13} strokeWidth={1.8} color={colors.fg} />
            <Text style={[styles.pillText, { color: colors.fg, fontFamily: fonts.sans.medium }]}>OPEN SETTINGS</Text>
          </Pressable>
        ) : null}
      </View>
      <Chip onPress={onBack}>Back</Chip>
    </View>
  )
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 8,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionLabel: { fontSize: 9.5, letterSpacing: 1.9, textTransform: 'uppercase' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingHorizontal: 24 },
  centerText: { alignItems: 'center', gap: 10 },
  micWrap: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  micRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
  },
  mic: { width: 130, height: 130, borderRadius: 65, alignItems: 'center', justifyContent: 'center' },
  display: { fontSize: 28, letterSpacing: -0.4, textAlign: 'center' },
  hint: { fontSize: 11, letterSpacing: 0.66, textAlign: 'center' },
  errIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errTitle: { fontSize: 22, textAlign: 'center' },
  errBody: { fontSize: 13, lineHeight: 19.5, textAlign: 'center', maxWidth: 280 },
  errActions: { alignItems: 'center', gap: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pillText: { fontSize: 12, letterSpacing: 0.6 },
})
