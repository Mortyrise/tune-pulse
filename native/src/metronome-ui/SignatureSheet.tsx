import { StyleSheet, Text, View } from 'react-native'
import { DENOMINATOR_OPTIONS, type Denominator } from '../audio/metronome'
import { Chip } from '../components/atoms/Chip'
import { useTheme } from '../theme'
import { NOTE_LABEL_BY_DENOM, NUMERATOR_CHOICES } from './format'
import { SectionLabel } from './SectionLabel'

export type SignatureSheetContentProps = {
  numerator: number
  denominator: Denominator
  onNumeratorChange: (value: number) => void
  onDenominatorChange: (value: Denominator) => void
}

export function SignatureSheetContent({
  numerator,
  denominator,
  onNumeratorChange,
  onDenominatorChange,
}: SignatureSheetContentProps) {
  const { colors, fonts } = useTheme()
  return (
    <View style={styles.root}>
      <View>
        <SectionLabel style={styles.label}>Beats per bar</SectionLabel>
        <View style={styles.row}>
          {NUMERATOR_CHOICES.map((n) => (
            <Chip key={n} active={numerator === n} onPress={() => onNumeratorChange(n)}>
              {n}
            </Chip>
          ))}
        </View>
      </View>
      <View>
        <SectionLabel style={styles.label}>Note value</SectionLabel>
        <View style={styles.row}>
          {DENOMINATOR_OPTIONS.map((d) => {
            const active = denominator === d
            const color = active ? colors.bg : colors.fgDim
            return (
              <Chip key={d} active={active} onPress={() => onDenominatorChange(d)}>
                <Text style={{ color, fontFamily: fonts.sans.medium, fontSize: 12 }}>{d}</Text>
                <Text style={{ color, opacity: 0.6, fontSize: 14 }}>{NOTE_LABEL_BY_DENOM[d]}</Text>
              </Chip>
            )
          })}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  label: { marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
})
