import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'
import { formatElapsed } from './format'

export type SessionStripProps = {
  bar: number
  elapsedMs: number
  isRunning: boolean
  inCountIn: boolean
}

/** `BAR 012 · 00:32` + live / count-in / idle status. */
export function SessionStrip({ bar, elapsedMs, isRunning, inCountIn }: SessionStripProps) {
  const { colors, fonts } = useTheme()
  const text = { color: colors.muted, fontFamily: fonts.mono.regular }
  const status = inCountIn
    ? { label: '● count-in', color: colors.warn }
    : isRunning
      ? { label: '● live', color: colors.good }
      : { label: '○ idle', color: colors.muted }
  return (
    <View style={[styles.root, { borderColor: colors.border }]}>
      <View style={styles.left}>
        <Text style={[styles.text, text]}>
          BAR{' '}
          <Text style={{ color: colors.fg, fontFamily: fonts.mono.semibold }}>{String(bar).padStart(3, '0')}</Text>
        </Text>
        <Text style={[styles.text, text, styles.dim]}>·</Text>
        <Text style={[styles.text, text]}>{formatElapsed(elapsedMs)}</Text>
      </View>
      <Text style={[styles.text, text, { color: status.color }, !isRunning && styles.idle]}>{status.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { fontSize: 10.5, letterSpacing: 0.6, fontVariant: ['tabular-nums'] },
  dim: { opacity: 0.4 },
  idle: { opacity: 0.55 },
})
