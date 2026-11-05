// Tuner screen: web tuner behaviour (sticky note, hold-to-confirm, history,
// chromatic / instrument targets) on plain RN views. Display logic lives in
// src/tuner-ui/display.ts (pure, tested); this file only composes.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import * as Haptics from 'expo-haptics'
import {
  formatNoteName,
  midiToFrequency,
  octaveFromMidi,
  splitNoteName,
  type Notation,
} from '../core/notes'
import { INSTRUMENTS, findClosestString, getInstrument, type InstrumentId } from '../core/instruments'
import { useTuner, type TunerDebug } from '../hooks/useTuner'
import * as tunerAudio from '../audio/tuner'
import type { TunerPreset } from '../audio/tuner'
import {
  HISTORY_MAX,
  TONE_COLORS,
  centsTone,
  formatCents,
  narrative,
  type ViewConfig,
} from '../tuner-ui/display'
import {
  COLORS,
  CentsBar,
  ChipRow,
  Collapsible,
  HistoryStrip,
  HoldBar,
  StringRow,
} from '../tuner-ui/components'

const KEEP_AWAKE_TAG = 'tuner'
const REFERENCE_A4_PRESETS = [415, 432, 438, 440, 442, 444] as const
const TOLERANCE_OPTIONS = [3, 5, 10] as const
const NOTATIONS: readonly Notation[] = ['english', 'latin']

// Presets come from tuner.ts (06 exports TUNER_PRESETS / DEFAULT_TUNER_PRESET).
// Read through the namespace so this compiles whether or not they exist yet.
type PresetInfo = { id: TunerPreset; label: string; description?: string }
const audioMod = tunerAudio as unknown as {
  TUNER_PRESETS?: readonly PresetInfo[]
  DEFAULT_TUNER_PRESET?: TunerPreset
}
const PRESETS: readonly PresetInfo[] =
  audioMod.TUNER_PRESETS && audioMod.TUNER_PRESETS.length > 0
    ? audioMod.TUNER_PRESETS
    : [
        { id: 'full' as TunerPreset, label: 'full' },
        { id: 'light' as TunerPreset, label: 'light' },
      ]
const DEFAULT_PRESET: TunerPreset = audioMod.DEFAULT_TUNER_PRESET ?? PRESETS[0].id

type Panel = 'reference' | 'tolerance' | null

export default function TunerScreen({ active }: { active: boolean }) {
  const [instrumentId, setInstrumentId] = useState<InstrumentId>('chromatic')
  const [referenceA4, setReferenceA4] = useState(440)
  const [inTuneCents, setInTuneCents] = useState<number>(5)
  const [notation, setNotation] = useState<Notation>('english')
  const [preset, setPreset] = useState<TunerPreset>(DEFAULT_PRESET)
  const [panel, setPanel] = useState<Panel>(null)
  const [debugOpen, setDebugOpen] = useState(false)

  const viewConfig = useMemo<ViewConfig>(() => ({ referenceA4, inTuneCents }), [referenceA4, inTuneCents])
  const { status, error, sample, debug, view, start, stop } = useTuner(viewConfig)
  const busy = status === 'running' || status === 'starting'

  // Stop when the tab is hidden.
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

  // One light haptic per confirm (confirmCount increments on false -> true).
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

  const note = view.note
  const cents = note ? note.cents : null
  const tone = cents === null ? null : centsTone(cents, inTuneCents)
  const color = tone ? TONE_COLORS[tone] : COLORS.muted
  const isInTune = tone === 'good'

  const noteName = note ? formatNoteName(((note.midi % 12) + 12) % 12, notation) : null
  const split = noteName ? splitNoteName(noteName) : null

  const instrument = getInstrument(instrumentId)
  const closest = note && instrument.strings ? findClosestString(note.midi, instrument.strings) : null

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ChipRow
        scroll
        options={INSTRUMENTS.map((i) => i.id)}
        value={instrumentId}
        onChange={setInstrumentId}
        label={(id) => getInstrument(id).name}
      />

      <View style={styles.meta}>
        <Pressable onPress={() => setPanel(panel === 'reference' ? null : 'reference')} hitSlop={6}>
          <Text style={styles.metaText}>
            A4 · <Text style={styles.metaStrong}>{referenceA4} Hz</Text> {panel === 'reference' ? '▾' : '▸'}
          </Text>
        </Pressable>
        <Pressable onPress={() => setPanel(panel === 'tolerance' ? null : 'tolerance')} hitSlop={6}>
          <Text style={styles.metaText}>
            ±<Text style={styles.metaStrong}>{inTuneCents}¢</Text> {panel === 'tolerance' ? '▾' : '▸'}
          </Text>
        </Pressable>
        <Text style={styles.metaText}>clarity {note ? Math.round(note.clarity * 100) : '—'}%</Text>
        {view.confirmed ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓ IN TUNE</Text>
          </View>
        ) : null}
      </View>

      {panel === 'reference' ? (
        <ChipRow
          options={REFERENCE_A4_PRESETS}
          value={referenceA4 as (typeof REFERENCE_A4_PRESETS)[number]}
          onChange={(hz) => {
            setReferenceA4(hz)
            setPanel(null)
          }}
          label={(hz) => `${hz} Hz`}
        />
      ) : null}
      {panel === 'tolerance' ? (
        <ChipRow
          options={TOLERANCE_OPTIONS}
          value={inTuneCents as (typeof TOLERANCE_OPTIONS)[number]}
          onChange={(c) => {
            setInTuneCents(c)
            setPanel(null)
          }}
          label={(c) => `±${c}¢`}
        />
      ) : null}

      <View style={styles.noteBox}>
        <View style={styles.noteRow}>
          <Text style={[styles.note, { color: note ? color : COLORS.muted }]}>{split ? split.base : '—'}</Text>
          {split?.accidental ? <Text style={[styles.accidental, { color }]}>{split.accidental}</Text> : null}
        </View>
        <Text style={styles.octave}>{note ? `OCT ${octaveFromMidi(note.midi)}` : ' '}</Text>
      </View>

      <CentsBar cents={cents} inTuneCents={inTuneCents} color={color} />
      <HoldBar progress={view.holdProgress} confirmed={view.confirmed} />

      <View style={styles.readout}>
        <View>
          <Text style={[styles.cents, { color }]}>
            {cents === null ? '0.0' : formatCents(cents)}
            <Text style={styles.centsUnit}>¢</Text>
          </Text>
          <Text style={styles.metaText}>{narrative(cents)}</Text>
        </View>
        <View style={styles.readoutRight}>
          <Text style={styles.hz}>
            {note ? note.frequency.toFixed(2) : '—'} <Text style={styles.metaText}>Hz</Text>
          </Text>
          <Text style={styles.metaText}>
            target {note ? midiToFrequency(note.midi, referenceA4).toFixed(2) : '—'} Hz
          </Text>
        </View>
      </View>

      <HistoryStrip history={view.history} max={HISTORY_MAX} inTuneCents={inTuneCents} />

      <View style={styles.target}>
        <View style={styles.targetHead}>
          <Text style={styles.targetTitle}>{instrument.name}</Text>
          <Text style={styles.metaText}>
            {instrument.strings
              ? closest
                ? closest.semitoneDelta === 0
                  ? `string ${closest.index + 1} · ${cents === null ? '' : `${formatCents(cents)}¢`}`
                  : `string ${closest.index + 1} · ${closest.semitoneDelta > 0 ? '+' : ''}${closest.semitoneDelta} st`
                : 'play a string'
              : 'Any pitch · 12 notes'}
          </Text>
        </View>
        {instrument.strings ? (
          <StringRow
            strings={instrument.strings.map((s) => ({
              label: `${formatNoteName(((s.midi % 12) + 12) % 12, notation)}${octaveFromMidi(s.midi)}`,
            }))}
            activeIndex={closest ? closest.index : null}
            inTune={isInTune && closest?.semitoneDelta === 0}
          />
        ) : null}
      </View>

      {status === 'error' && error ? (
        <Text style={styles.error}>
          {error.kind === 'denied' ? 'Mic permission denied. ' : 'Error: '}
          {error.message}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.notation}>
          <ChipRow
            options={NOTATIONS}
            value={notation}
            onChange={setNotation}
            label={(n) => (n === 'english' ? 'C – D – E' : 'Do – Re – Mi')}
          />
        </View>
        <Pressable
          onPress={() => (busy ? stop() : void start(preset))}
          style={[styles.button, busy && styles.buttonStop]}
        >
          <Text style={styles.buttonText}>
            {status === 'starting' ? 'Starting…' : busy ? 'Stop' : 'Start'}
          </Text>
        </Pressable>
      </View>

      <Collapsible title="DEBUG" open={debugOpen} onToggle={() => setDebugOpen((o) => !o)}>
        <ChipRow options={PRESETS.map((p) => p.id)} value={preset} onChange={choosePreset} label={presetLabel} />
        {PRESETS.find((p) => p.id === preset)?.description ? (
          <Text style={styles.debug}>{PRESETS.find((p) => p.id === preset)?.description}</Text>
        ) : null}
        <Text style={styles.debug}>{debugText(status, debug, sample)}</Text>
      </Collapsible>
    </ScrollView>
  )
}

function presetLabel(id: TunerPreset): string {
  return PRESETS.find((p) => p.id === id)?.label ?? String(id)
}

function debugText(
  status: string,
  debug: TunerDebug | null,
  sample: { frequency: number; clarity: number; rms: number } | null,
): string {
  const raw = sample
    ? `out ${sample.frequency > 0 ? sample.frequency.toFixed(2) : '—'} Hz | clarity ${sample.clarity.toFixed(2)} | rms ${sample.rms.toFixed(4)}`
    : 'out —'
  if (!debug) return `status: ${status}\n${raw}`
  const lines = [
    `${debug.preset} | sr ${debug.sampleRate} (device ${debug.deviceSampleRate || '?'}) | buf ${debug.bufferSize} | win ${debug.windowSize}` +
      (debug.lowpassHz !== undefined ? ` | lp ${debug.lowpassHz || 'off'}` : '') +
      (debug.rmsThreshold !== undefined ? ` | gate ${debug.rmsThreshold}` : ''),
    `${debug.analysesPerSec.toFixed(1)} analyses/s | ${debug.msPerAnalysis.toFixed(2)} ms/analysis | lag ${Math.round(debug.lagMs)} ms | rec errors ${debug.errors}`,
    raw,
  ]
  if (debug.last) {
    const l = debug.last
    const hf = l.rmsUnfiltered > 0 ? 1 - (l.rms / l.rmsUnfiltered) ** 2 : 0
    lines.push(
      `last ${l.reason} | raw ${l.rawFrequency > 0 ? l.rawFrequency.toFixed(2) : '—'} Hz | clarity ${l.clarity.toFixed(2)} | rms ${l.rms.toFixed(4)} | unf ${l.rmsUnfiltered.toFixed(4)} | hf ${(hf * 100).toFixed(0)}%`,
    )
  }
  if (debug.voiced !== undefined) {
    lines.push(
      `voiced ${debug.voiced} | rej gate ${debug.rejGate ?? 0} | clarity ${debug.rejClarity ?? 0} | nopeak ${debug.rejNoPeak ?? 0}`,
    )
  }
  if (debug.lastError) lines.push(`last error: ${debug.lastError}`)
  return lines.join('\n')
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, gap: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: COLORS.muted, letterSpacing: 0.4 },
  metaStrong: { color: COLORS.fg, fontWeight: '600' },
  badge: { backgroundColor: COLORS.good, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  noteBox: { alignItems: 'center', paddingVertical: 4 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start' },
  note: { fontSize: 104, fontWeight: '300', lineHeight: 116 },
  accidental: { fontSize: 44, marginTop: 12, marginLeft: 2 },
  octave: { fontSize: 12, color: COLORS.muted, letterSpacing: 2 },
  readout: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  readoutRight: { alignItems: 'flex-end' },
  cents: { fontSize: 30, fontWeight: '300', fontVariant: ['tabular-nums'] },
  centsUnit: { fontSize: 16 },
  hz: { fontSize: 18, color: COLORS.fg, fontVariant: ['tabular-nums'] },
  target: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: '#fff',
  },
  targetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  targetTitle: { fontSize: 15, fontWeight: '600', color: COLORS.fg },
  error: { color: COLORS.bad },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notation: { flex: 1 },
  button: { backgroundColor: COLORS.good, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, alignItems: 'center' },
  buttonStop: { backgroundColor: COLORS.bad },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  debug: { fontSize: 11, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), color: '#666' },
})
