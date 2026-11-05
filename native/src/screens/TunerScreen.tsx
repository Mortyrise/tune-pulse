// Tuner screen (pulse·groove). Behaviour: useTuner + reduceView (sticky note,
// smoothing, hold-to-confirm, history). Settings: useTunerSettings. Visuals:
// 09's atoms; screen-specific pieces live in src/tuner-ui/.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { useRouter } from 'expo-router'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import * as Haptics from 'expo-haptics'
import { midiToFrequency, type Notation } from '../core/notes'
import { INSTRUMENTS, findClosestString, getInstrument } from '../core/instruments'
import { DEFAULT_TUNER_PRESET, TUNER_PRESETS, type TunerPreset } from '../audio/tuner'
import { useTuner } from '../hooks/useTuner'
import { REFERENCE_A4_PRESETS, usePersistentState, useTunerSettings } from '../settings'
import { useTheme } from '../theme'
import { BottomSheet } from '../components/atoms/BottomSheet'
import { CentsRing } from '../components/atoms/CentsRing'
import { Chip } from '../components/atoms/Chip'
import { HistoryStrip } from '../components/atoms/HistoryStrip'
import { Icon } from '../components/Icon'
import { centsTone, formatCents, narrative, toneColor, type ViewConfig } from '../tuner-ui/display'
import { clarityPercent, errorCopy, idleHint, noteParts } from '../tuner-ui/format'
import { TargetCard } from '../tuner-ui/TargetCard'
import { TunerErrorView, TunerIdleView, TunerTopBar } from '../tuner-ui/TunerStates'
import { DebugPanel } from '../tuner-ui/DebugPanel'
import { InTuneBadge } from '../tuner-ui/InTuneBadge'

const KEEP_AWAKE_TAG = 'tuner'
const PRESET_KEY = 'tunepulse:tuner-preset'
const RING_MAX = 290
const SIDE_PADDING = 24

type SheetKind = 'reference' | 'instrument' | null

const parsePreset = (v: unknown): TunerPreset | undefined =>
  TUNER_PRESETS.some((p) => p.id === v) ? (v as TunerPreset) : undefined

export default function TunerScreen({ active = true }: { active?: boolean }) {
  const { colors, fonts } = useTheme()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { settings, updateSettings, hydrated } = useTunerSettings()
  const { referenceA4, inTuneCents, notation, accidental } = settings
  const [preset, setPreset] = usePersistentState<TunerPreset>(PRESET_KEY, DEFAULT_TUNER_PRESET, parsePreset)
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [debugOpen, setDebugOpen] = useState(false)

  const viewConfig = useMemo<ViewConfig>(() => ({ referenceA4, inTuneCents }), [referenceA4, inTuneCents])
  const { status, error, sample, debug, view, start, stop } = useTuner(viewConfig)
  const busy = status === 'running' || status === 'starting'

  // Listen only while the tab is focused.
  useEffect(() => {
    if (!active) stop()
  }, [active, stop])

  useEffect(() => {
    if (status !== 'running') return
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined)
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined)
    }
  }, [status])

  // One haptic per confirm (confirmCount increments on false -> true).
  const lastConfirmRef = useRef(0)
  useEffect(() => {
    if (view.confirmCount > lastConfirmRef.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
    }
    lastConfirmRef.current = view.confirmCount
  }, [view.confirmCount])

  const choosePreset = (p: TunerPreset) => {
    if (p === preset) return
    setPreset(p)
    if (busy) void start(p) // restart with the new preset
  }

  const instrument = getInstrument(settings.instrument)
  const openSettings = () => router.push('/settings')
  const toggleDebug = () => setDebugOpen((o) => !o)

  const debugPanel = debugOpen ? (
    <DebugPanel preset={preset} onPreset={choosePreset} status={status} debug={debug} sample={sample} />
  ) : null

  const sheets = (
    <>
      <BottomSheet open={sheet === 'reference'} onClose={() => setSheet(null)} title="Reference pitch">
        <View style={styles.sheetBody}>
          <Text style={[styles.sheetCopy, { color: colors.muted, fontFamily: fonts.mono.regular }]}>
            The frequency assigned to A above middle C. Most modern music uses 440 Hz; some European orchestras
            prefer 442, early-music ensembles 415.
          </Text>
          <View style={styles.chipWrap}>
            {REFERENCE_A4_PRESETS.map((hz) => (
              <Chip
                key={hz}
                active={referenceA4 === hz}
                style={styles.hzChip}
                onPress={() => {
                  updateSettings({ referenceA4: hz })
                  setSheet(null)
                }}
              >
                {`${hz} Hz`}
              </Chip>
            ))}
          </View>
        </View>
      </BottomSheet>
      <BottomSheet open={sheet === 'instrument'} onClose={() => setSheet(null)} title="Instrument target">
        <View>
          {INSTRUMENTS.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: settings.instrument === option.id }}
              onPress={() => {
                updateSettings({ instrument: option.id })
                setSheet(null)
              }}
              style={[styles.instRow, { borderBottomColor: colors.border }]}
            >
              <View style={styles.instName}>
                <Text style={[styles.instTitle, { color: colors.fg, fontFamily: fonts.sans.medium }]}>
                  {option.name}
                </Text>
                {settings.instrument === option.id ? (
                  <Icon name="check" size={13} strokeWidth={2} color={colors.accent} />
                ) : null}
              </View>
              <Text style={[styles.instStrings, { color: colors.muted, fontFamily: fonts.mono.regular }]}>
                {option.strings ? option.strings.map((s) => s.name).join(' ') : 'any pitch'}
              </Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </>
  )

  // --- idle / starting / error --------------------------------------------
  if (status !== 'running') {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <TunerTopBar label="Tuner" onSettings={openSettings} onLongPressLabel={toggleDebug} />
          {status === 'error' && error ? (
            <TunerErrorView
              copy={errorCopy(error.kind, error.message)}
              onRetry={() => void start(preset)}
              onOpenSettings={() => void Linking.openSettings().catch(() => undefined)}
              onBack={stop}
            />
          ) : (
            <TunerIdleView
              starting={status === 'starting'}
              disabled={!hydrated}
              hint={idleHint(instrument.name, referenceA4, inTuneCents)}
              onStart={() => void start(preset)}
            />
          )}
          {debugPanel}
        </ScrollView>
        {sheets}
      </View>
    )
  }

  // --- running ---------------------------------------------------------------
  const note = view.note
  const cents = note ? note.cents : null
  const tone = cents === null ? null : centsTone(cents, inTuneCents)
  const toneFg = tone ? toneColor(tone, colors) : colors.muted
  const isInTune = tone === 'good'
  const parts = note ? noteParts(note.midi, notation, accidental) : null
  const closest = note && instrument.strings ? findClosestString(note.midi, instrument.strings) : null
  const ringSize = Math.min(RING_MAX, width - SIDE_PADDING * 2)
  const mono = { color: colors.muted, fontFamily: fonts.mono.regular }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <TunerTopBar label={instrument.name} onSettings={openSettings} onLongPressLabel={toggleDebug} />

        <View style={styles.meta}>
          <Pressable
            onPress={() => setSheet('reference')}
            hitSlop={8}
            style={styles.metaBtn}
            accessibilityRole="button"
            accessibilityLabel={`Reference pitch ${referenceA4} hertz`}
          >
            <Text style={[styles.metaText, mono]}>
              A4 ·{' '}
              <Text style={{ color: colors.fg, fontFamily: fonts.mono.medium }}>{referenceA4} Hz</Text>
            </Text>
            <Icon name="chevronRight" size={11} strokeWidth={1.8} color={colors.muted} />
          </Pressable>
          <View style={styles.metaRight}>
            <Text style={[styles.metaText, mono]}>clarity {clarityPercent(note?.clarity)}%</Text>
            {view.confirmed ? <InTuneBadge /> : null}
          </View>
        </View>

        <View style={styles.ringBox}>
          <CentsRing
            cents={cents ?? 0}
            active={note !== null}
            noteLabel={parts?.base ?? null}
            accidental={parts?.accidental ?? null}
            octave={parts?.octave ?? null}
            size={ringSize}
            holdProgress={view.holdProgress}
            inTuneCents={inTuneCents}
          />
        </View>

        <View style={styles.readout}>
          <View style={styles.shrink}>
            <Text style={[styles.cents, { color: toneFg, fontFamily: fonts.mono.light }]}>
              {cents === null ? '0.0' : formatCents(cents)}
              <Text style={styles.centsUnit}>¢</Text>
            </Text>
            <Text style={[styles.metaText, styles.below, mono]}>{narrative(cents)}</Text>
          </View>
          <View style={[styles.shrink, styles.right]}>
            <Text style={[styles.hz, { color: colors.fg, fontFamily: fonts.mono.regular }]}>
              {note ? note.frequency.toFixed(2) : '—'} <Text style={[styles.hzUnit, { color: colors.muted }]}>Hz</Text>
            </Text>
            <Text style={[styles.metaText, styles.below, mono]}>
              target {note ? midiToFrequency(note.midi, referenceA4).toFixed(2) : '—'} Hz
            </Text>
          </View>
        </View>

        <HistoryStrip history={view.history} inTuneCents={inTuneCents} />

        <TargetCard
          instrument={instrument}
          note={parts}
          cents={cents}
          closest={closest}
          isInTune={isInTune}
          notation={notation}
          accidental={accidental}
          onChange={() => setSheet('instrument')}
        />

        <View style={styles.footer}>
          <View style={[styles.segment, { backgroundColor: colors.paper, borderColor: colors.borderStrong }]}>
            {(['english', 'latin'] as const satisfies readonly Notation[]).map((n) => {
              const selected = notation === n
              return (
                <Pressable
                  key={n}
                  onPress={() => updateSettings({ notation: n })}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.segBtn, selected && { backgroundColor: colors.fg }]}
                >
                  <Text
                    style={[
                      styles.segText,
                      { color: selected ? colors.bg : colors.muted, fontFamily: fonts.sans.medium },
                    ]}
                  >
                    {n === 'english' ? 'C – D – E' : 'Do – Re – Mi'}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <Pressable
            onPress={stop}
            accessibilityRole="button"
            accessibilityLabel="Stop tuner"
            style={[styles.stopBtn, { borderColor: colors.borderStrong }]}
          >
            <Icon name="micOff" size={16} strokeWidth={1.6} color={colors.fgDim} />
          </Pressable>
        </View>

        {debugPanel}
      </ScrollView>
      {sheets}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: SIDE_PADDING, paddingTop: 12, paddingBottom: 16, gap: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  metaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaText: { fontSize: 10.5, letterSpacing: 0.63 },
  ringBox: { height: 280, alignItems: 'center', justifyContent: 'center' },
  readout: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  shrink: { flexShrink: 1 },
  right: { alignItems: 'flex-end' },
  below: { marginTop: 6 },
  cents: { fontSize: 28, letterSpacing: -0.56, lineHeight: 30 },
  centsUnit: { fontSize: 15 },
  hz: { fontSize: 18 },
  hzUnit: { fontSize: 11 },
  footer: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  segment: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segText: { fontSize: 12, letterSpacing: 0.48 },
  stopBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: { gap: 12 },
  sheetCopy: { fontSize: 11, lineHeight: 16.5 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hzChip: { minWidth: 72 },
  instRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  instName: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  instTitle: { fontSize: 14 },
  instStrings: { fontSize: 10.5, letterSpacing: 0.42 },
})
