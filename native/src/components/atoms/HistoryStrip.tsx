import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme'
import { centsTone, DEFAULT_IN_TUNE_CENTS } from './svgGeometry'

const SLOTS = 12
const MAX_CENTS = 50
const MAX_OFFSET_PX = 9

export type HistorySample = {
  cents: number
}

export type HistoryStripProps = {
  history: HistorySample[]
  /** Tolerance in cents: good ≤ inTuneCents, warn ≤ 3×. Default 5 (web). */
  inTuneCents?: number
}

export function HistoryStrip({ history, inTuneCents = DEFAULT_IN_TUNE_CENTS }: HistoryStripProps) {
  const { colors, fonts } = useTheme()

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.muted, fontFamily: fonts.sans.semibold }]}>
          RECENT
        </Text>
        <Text style={[styles.count, { color: colors.muted, fontFamily: fonts.mono.regular }]}>
          last {SLOTS}
        </Text>
      </View>
      <View style={[styles.track, { borderColor: colors.border }]}>
        <View style={[styles.midline, { backgroundColor: colors.borderStrong }]} />
        {Array.from({ length: SLOTS }, (_, index) => {
          const sample = history[index]
          if (!sample) {
            return (
              <View key={index} style={[styles.empty, { backgroundColor: colors.borderStrong }]} />
            )
          }
          const offset = Math.max(-1, Math.min(1, sample.cents / MAX_CENTS))
          return (
            <View key={index} style={styles.slot}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: colors[centsTone(sample.cents, inTuneCents)],
                    transform: [{ translateY: offset * MAX_OFFSET_PX }],
                  },
                ]}
              />
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontSize: 9.5, letterSpacing: 1.9 },
  count: { fontSize: 9.5, letterSpacing: 0.57 },
  track: {
    height: 26,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  midline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: StyleSheet.hairlineWidth,
  },
  empty: { flex: 1, height: 3, borderRadius: 1.5, opacity: 0.4 },
  slot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
})
