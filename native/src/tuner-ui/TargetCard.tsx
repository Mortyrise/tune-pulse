// Instrument target card (web InstrumentTargetCard): closest-string row or the chromatic readout.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '../components/Icon'
import type { ClosestStringMatch, Instrument } from '../core/instruments'
import type { Accidental, Notation } from '../core/notes'
import { useTheme } from '../theme'
import { noteParts, stringDeltaLabel, type NoteParts } from './format'

export function TargetCard({
  instrument,
  note,
  cents,
  closest,
  isInTune,
  notation,
  accidental,
  onChange,
}: {
  instrument: Instrument
  /** Displayed note (null when nothing is held). */
  note: NoteParts | null
  cents: number | null
  closest: ClosestStringMatch | null
  isInTune: boolean
  notation: Notation
  accidental: Accidental
  onChange: () => void
}) {
  const { colors, fonts } = useTheme()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.paper, borderColor: colors.border, boxShadow: '0 4px 12px -8px rgba(0,0,0,0.1)' },
      ]}
    >
      <View style={styles.head}>
        <Text style={[styles.label, { color: colors.muted, fontFamily: fonts.sans.semibold }]}>
          {instrument.name} target
        </Text>
        <Pressable onPress={onChange} hitSlop={10} style={styles.change} accessibilityRole="button">
          <Text style={[styles.changeText, { color: colors.accent, fontFamily: fonts.mono.medium }]}>change</Text>
          <Icon name="chevronRight" size={10} strokeWidth={1.8} color={colors.accent} />
        </Pressable>
      </View>
      {instrument.strings ? (
        <View style={styles.strings}>
          {instrument.strings.map((s, i) => {
            const isClosest = closest?.index === i
            const tuned = isClosest && isInTune && closest?.semitoneDelta === 0
            const parts = noteParts(s.midi, notation, accidental)
            const dot = tuned ? colors.good : isClosest ? colors.accent : colors.borderStrong
            const delta = isClosest && closest ? stringDeltaLabel(closest.semitoneDelta, cents) : ''
            return (
              <View
                key={`${s.name}-${i}`}
                style={[styles.string, isClosest && { backgroundColor: colors.bg }]}
                accessibilityLabel={`String ${i + 1}, ${parts.base}${parts.accidental ?? ''}${parts.octave}`}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.stringName,
                    { color: tuned ? colors.good : isClosest ? colors.fg : colors.muted, fontFamily: fonts.sans.medium },
                  ]}
                >
                  {parts.base}
                  {parts.accidental ?? ''}
                  <Text style={styles.sub}>{parts.octave}</Text>
                </Text>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: dot },
                    tuned && { boxShadow: `0 0 0 3px ${colors.accentSoft}` },
                  ]}
                />
                <Text numberOfLines={1} style={[styles.delta, { color: colors.muted, fontFamily: fonts.mono.regular }]}>
                  {delta || ' '}
                </Text>
              </View>
            )
          })}
        </View>
      ) : (
        <View style={styles.chromatic}>
          <Text style={[styles.any, { color: colors.muted, fontFamily: fonts.mono.regular }]}>Any pitch · 12 notes</Text>
          <Text style={[styles.detected, { color: colors.fg, fontFamily: fonts.mono.regular }]}>
            {note ? (
              <>
                {note.base}
                {note.accidental ?? ''}
                <Text style={styles.sub}>{note.octave}</Text>
              </>
            ) : (
              '—'
            )}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 9.5, letterSpacing: 1.9, textTransform: 'uppercase' },
  change: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  changeText: { fontSize: 10.5, letterSpacing: 0.6 },
  strings: { flexDirection: 'row', gap: 4 },
  string: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10 },
  stringName: { fontSize: 13 },
  sub: { fontSize: 8, opacity: 0.6 },
  dot: { width: 6, height: 6, borderRadius: 99 },
  delta: { fontSize: 9 },
  chromatic: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  any: { fontSize: 11 },
  detected: { fontSize: 12, letterSpacing: 0.7 },
})
