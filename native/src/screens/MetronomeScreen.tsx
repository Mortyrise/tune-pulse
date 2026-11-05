// Metronome screen (pulse·groove): handoff "Metronome screen" + "Saved Grooves", web
// src/screens/MetronomeScreen.tsx. State lives in MetronomeProvider (keeps playing across
// tabs); `active` (tab focused) only gates beat-rate UI updates.
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { router } from 'expo-router'
import { nextSubdivision } from '../audio/metronome'
import { BrandMark } from '../components/BrandMark'
import { Icon } from '../components/Icon'
import { BeatColumn } from '../components/atoms/BeatColumn'
import { BottomSheet } from '../components/atoms/BottomSheet'
import { Chip } from '../components/atoms/Chip'
import { Dial } from '../components/atoms/Dial'
import { PulseRings } from '../components/atoms/PulseRings'
import { grooveToConfig, type Groove } from '../core/grooves'
import { getTempoCharacter } from '../core/tempo'
import { MAX_BPM, MIN_BPM, useMetronome } from '../hooks/useMetronome'
import { useSavedPatterns, type SavedPattern } from '../hooks/useSavedPatterns'
import { useTapTempo } from '../hooks/useTapTempo'
import { GroovesSheetContent } from '../metronome-ui/GroovesSheet'
import { PlayButton } from '../metronome-ui/PlayButton'
import { SectionLabel } from '../metronome-ui/SectionLabel'
import { SessionStrip } from '../metronome-ui/SessionStrip'
import { SignatureSheetContent } from '../metronome-ui/SignatureSheet'
import { NOTE_LABEL_BY_DENOM, brandPulseMs, countInLabel, displayedBar, nextCountIn } from '../metronome-ui/format'
import { useTheme } from '../theme'

type SheetKind = 'signature' | 'grooves' | null

const DIAL_SIZE = 260
const RINGS_SIZE = 244
const ELAPSED_TICK_MS = 250

/** Wall clock refreshed every 250 ms while `enabled` (session strip timer). */
function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(Date.now()), ELAPSED_TICK_MS)
    return () => clearInterval(id)
  }, [enabled])
  return now
}

export default function MetronomeScreen({ active = true }: { active?: boolean }) {
  const { colors, fonts } = useTheme()
  const {
    config,
    isRunning,
    startedAt,
    runCountInBars,
    activeBeat,
    error,
    toggle,
    setBpm,
    setCountInBars,
    setNumerator,
    setDenominator,
    toggleAccent,
    setSubdivision,
    setHapticMode,
    applyConfig,
  } = useMetronome({ live: active })
  const { tap } = useTapTempo({ onBpm: setBpm })
  const { patterns, save, remove } = useSavedPatterns()
  const [sheet, setSheet] = useState<SheetKind>(null)
  const closeSheet = () => setSheet(null)

  const now = useNow(active && startedAt !== null)
  const elapsedMs = startedAt === null ? 0 : Math.max(0, now - startedAt)

  const inCountIn = activeBeat?.phase === 'count-in'
  const currentBeat = activeBeat?.beat ?? 0
  const currentSub = activeBeat?.subdivision ?? 0
  const tempo = getTempoCharacter(config.bpm)

  const applyGroove = (groove: Groove) => {
    applyConfig(grooveToConfig(groove, config))
    closeSheet()
  }
  const applySavedPattern = (pattern: SavedPattern) => {
    applyConfig(pattern.config)
    closeSheet()
  }

  const mono = fonts.mono.regular

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <BrandMark pulseMs={brandPulseMs(config.bpm, isRunning)} />
          <View style={styles.topRight}>
            <SectionLabel>Metronome</SectionLabel>
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <Icon name="settings" size={14} strokeWidth={1.6} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.tempoRow}>
          <Text style={[styles.tempoName, { color: colors.fg, fontFamily: fonts.display.italic }]}>{tempo.name}</Text>
          <Text style={[styles.tempoMeaning, { color: colors.muted, fontFamily: mono }]}>· {tempo.meaning}</Text>
        </View>

        <View style={styles.hero}>
          <PulseRings
            tickId={activeBeat ? activeBeat.time : null}
            isRunning={isRunning}
            isAccent={activeBeat?.isAccent ?? false}
            size={RINGS_SIZE}
          />
          <Dial value={config.bpm} min={MIN_BPM} max={MAX_BPM} onChange={setBpm} size={DIAL_SIZE} isRunning={isRunning}>
            <Text style={[styles.bpm, { color: colors.fg, fontFamily: fonts.display.light }]}>{config.bpm}</Text>
            <View style={styles.caption}>
              <Text style={[styles.captionText, { color: colors.muted, fontFamily: mono }]}>BPM</Text>
              <Text style={[styles.captionText, styles.captionDot, { color: colors.muted, fontFamily: mono }]}>·</Text>
              <Text style={[styles.captionText, styles.captionDrag, { color: colors.muted, fontFamily: mono }]}>
                drag
              </Text>
            </View>
            <Pressable
              onPress={() => setSheet('signature')}
              style={[styles.signature, { backgroundColor: colors.paper, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={`Time signature ${config.numerator}/${config.denominator}`}
            >
              <Text style={[styles.signatureText, { color: colors.fg, fontFamily: mono }]}>
                {config.numerator}/{config.denominator}
              </Text>
              <Text style={[styles.signatureNote, { color: colors.muted }]}>
                {NOTE_LABEL_BY_DENOM[config.denominator]}
              </Text>
            </Pressable>
          </Dial>
        </View>

        <View style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <SectionLabel>Bar pattern</SectionLabel>
            <Text style={[styles.cardHint, { color: colors.muted, fontFamily: mono }]}>tap · cycle clicks</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.beats}>
            {Array.from({ length: config.numerator }, (_, i) => {
              const subdivision = config.beats.subdivisions[i] ?? 1
              return (
                <BeatColumn
                  key={i}
                  beat={i + 1}
                  isAccent={config.beats.accents.includes(i + 1)}
                  subdivision={subdivision}
                  currentBeat={currentBeat}
                  currentSub={currentSub}
                  isRunning={isRunning}
                  inCountIn={inCountIn}
                  onToggleAccent={() => toggleAccent(i + 1)}
                  onCycleSubdivision={() => setSubdivision(i, nextSubdivision(subdivision))}
                />
              )
            })}
          </ScrollView>
        </View>

        <SessionStrip
          bar={displayedBar(activeBeat, runCountInBars, isRunning)}
          elapsedMs={elapsedMs}
          isRunning={isRunning}
          inCountIn={inCountIn}
        />

        <View style={styles.chips}>
          <Chip onPress={tap} accessibilityLabel="Tap tempo">
            <Icon name="hand" size={12} strokeWidth={1.8} />
            Tap tempo
          </Chip>
          <Chip active={config.countInBars > 0} onPress={() => setCountInBars(nextCountIn(config.countInBars))}>
            {`Count-in · ${countInLabel(config.countInBars)}`}
          </Chip>
          <Chip active={config.hapticMode} onPress={() => setHapticMode(!config.hapticMode)}>
            <Icon name={config.hapticMode ? 'vibrate' : 'volume2'} size={11} strokeWidth={1.8} />
            {config.hapticMode ? 'Haptic' : 'Audio'}
          </Chip>
          <Chip onPress={() => setSheet('grooves')}>
            <Icon name="bookmark" size={11} strokeWidth={1.8} />
            Grooves
          </Chip>
        </View>

        {error ? <Text style={[styles.error, { color: colors.bad, fontFamily: mono }]}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <PlayButton isRunning={isRunning} onPress={toggle} />
      </View>

      <BottomSheet open={sheet === 'signature'} onClose={closeSheet} title="Time signature">
        <SignatureSheetContent
          numerator={config.numerator}
          denominator={config.denominator}
          onNumeratorChange={setNumerator}
          onDenominatorChange={setDenominator}
        />
      </BottomSheet>

      <BottomSheet open={sheet === 'grooves'} onClose={closeSheet} title="Grooves">
        <GroovesSheetContent
          activeConfig={config}
          onApplyGroove={applyGroove}
          savedPatterns={patterns}
          onApplySavedPattern={applySavedPattern}
          onSave={(name) => save(name, config)}
          onDeleteSavedPattern={remove}
        />
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 14 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tempoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingBottom: 4 },
  tempoName: { fontSize: 22, letterSpacing: -0.22 },
  tempoMeaning: { fontSize: 10, letterSpacing: 0.4 },
  hero: { height: 268, marginTop: 4, marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  bpm: { fontSize: 86, lineHeight: 94, letterSpacing: -3.9, fontVariant: ['tabular-nums'] },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  captionText: { fontSize: 9.5, letterSpacing: 2.1, textTransform: 'uppercase' },
  captionDot: { opacity: 0.45 },
  captionDrag: { letterSpacing: 1.1 },
  signature: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signatureText: { fontSize: 13 },
  signatureNote: { fontSize: 14 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14, paddingHorizontal: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  cardHint: { fontSize: 9.5, letterSpacing: 0.6 },
  beats: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  error: { fontSize: 10.5 },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
})
