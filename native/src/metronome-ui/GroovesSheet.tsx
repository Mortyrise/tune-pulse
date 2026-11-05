import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { MetronomeConfig } from '../audio/metronome'
import { Icon } from '../components/Icon'
import { GROOVES_LIBRARY, type Groove } from '../core/grooves'
import type { SavedPattern } from '../hooks/useSavedPatterns'
import { useTheme } from '../theme'
import { patternSummary } from './format'
import { SectionLabel } from './SectionLabel'

export type GroovesSheetContentProps = {
  activeConfig: MetronomeConfig
  onApplyGroove: (groove: Groove) => void
  savedPatterns: SavedPattern[]
  onApplySavedPattern: (pattern: SavedPattern) => void
  onSave: (name: string) => void
  onDeleteSavedPattern: (id: string) => void
}

export function GroovesSheetContent({
  activeConfig,
  onApplyGroove,
  savedPatterns,
  onApplySavedPattern,
  onSave,
  onDeleteSavedPattern,
}: GroovesSheetContentProps) {
  const { colors, fonts } = useTheme()
  // Inline name field replaces the web window.prompt (RN has none on Android).
  const [draft, setDraft] = useState<string | null>(null)

  const name = { color: colors.fg, fontFamily: fonts.sans.medium }
  const meta = { color: colors.muted, fontFamily: fonts.mono.regular }
  const rowBorder = { borderBottomColor: colors.border }

  const commit = () => {
    if (draft === null) return
    onSave(draft)
    setDraft(null)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <SectionLabel style={styles.sectionLabel}>Library</SectionLabel>
          {GROOVES_LIBRARY.map((groove) => (
            <Pressable
              key={groove.id}
              onPress={() => onApplyGroove(groove)}
              style={[styles.row, rowBorder]}
              accessibilityRole="button"
              accessibilityLabel={`Apply ${groove.name}`}
            >
              <View style={styles.rowText}>
                <Text style={[styles.name, name]}>{groove.name}</Text>
                <Text style={[styles.hint, meta]}>{groove.hint}</Text>
              </View>
              <Text style={[styles.summary, meta]}>{patternSummary(groove)}</Text>
            </Pressable>
          ))}
        </View>

        <View>
          <View style={styles.mineHeader}>
            <SectionLabel>My grooves</SectionLabel>
            <Pressable
              onPress={() => setDraft(`${activeConfig.bpm} bpm · ${activeConfig.numerator}/${activeConfig.denominator}`)}
              style={styles.saveButton}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Icon name="bookmarkPlus" size={12} strokeWidth={1.8} color={colors.accent} />
              <Text style={{ color: colors.accent, fontFamily: fonts.sans.medium, fontSize: 12 }}>Save current</Text>
            </Pressable>
          </View>

          {draft !== null && (
            <View style={[styles.saveRow, { borderColor: colors.borderStrong }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={commit}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                placeholder="Groove name"
                placeholderTextColor={colors.muted}
                style={[styles.input, { color: colors.fg, fontFamily: fonts.sans.regular }]}
                accessibilityLabel="Groove name"
              />
              <Pressable onPress={() => setDraft(null)} hitSlop={6} accessibilityLabel="Cancel">
                <Icon name="x" size={14} strokeWidth={1.8} color={colors.muted} />
              </Pressable>
              <Pressable onPress={commit} hitSlop={6} accessibilityRole="button" accessibilityLabel="Save groove">
                <Icon name="check" size={16} strokeWidth={2} color={colors.accent} />
              </Pressable>
            </View>
          )}

          {savedPatterns.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted, fontFamily: fonts.sans.regular }]}>
              Nothing saved yet. Configure the metronome and tap{' '}
              <Text style={{ color: colors.accent }}>Save current</Text>.
            </Text>
          ) : (
            savedPatterns.map((pattern) => (
              <View key={pattern.id} style={[styles.row, rowBorder]}>
                <Pressable
                  onPress={() => onApplySavedPattern(pattern)}
                  style={styles.rowText}
                  accessibilityRole="button"
                  accessibilityLabel={`Apply ${pattern.name}`}
                >
                  <Text style={[styles.name, name]}>{pattern.name}</Text>
                  <Text style={[styles.hint, meta]}>{patternSummary(pattern.config)}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onDeleteSavedPattern(pattern.id)}
                  style={styles.delete}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${pattern.name}`}
                >
                  <Icon name="x" size={14} strokeWidth={1.8} color={colors.muted} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Text style={[styles.footer, meta]}>
          Current: {activeConfig.bpm} BPM · {activeConfig.numerator}/{activeConfig.denominator}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 420 },
  content: { gap: 20 },
  sectionLabel: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 4 },
  name: { fontSize: 14 },
  hint: { fontSize: 10.5, letterSpacing: 0.4 },
  summary: { fontSize: 11, fontVariant: ['tabular-nums'] },
  mineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  saveButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: 8 },
  empty: { fontSize: 12 },
  delete: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  footer: { fontSize: 9.5, letterSpacing: 0.8 },
})
