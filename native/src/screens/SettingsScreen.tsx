// Settings: appearance, tuner preferences, A4 reference, about + diagnostics.
// Pushed stack route — the native header/back button comes from the root layout.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import { Chip } from '../components/atoms/Chip'
import { Icon, type IconName } from '../components/Icon'
import { useTheme, type ThemeColors, type ThemeFonts, type ThemePreference } from '../theme'
import {
  DEFAULT_TUNER_SETTINGS,
  MAX_REFERENCE_A4,
  MIN_REFERENCE_A4,
  REFERENCE_A4_PRESETS,
  TOLERANCE_OPTIONS,
  clampReferenceA4,
  usePersistentState,
  useTunerSettings,
  type InTuneTolerance,
} from '../settings'
import { formatNoteName, type Accidental, type Notation } from '../core/notes'
import { INSTRUMENTS } from '../core/instruments'
import { DEFAULT_TUNER_PRESET, TUNER_PRESETS, type TunerPreset } from '../audio/tuner'
import { useMetronome, type EngineDiagnostics } from '../hooks/useMetronome'

const THEME_OPTIONS: { value: ThemePreference; label: string; icon?: IconName }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'mono', label: 'Mono', icon: 'contrast' },
]

const NOTATION_OPTIONS: { value: Notation; label: string }[] = [
  { value: 'english', label: 'C-D-E' },
  { value: 'latin', label: 'Do-Re-Mi' },
]

const ACCIDENTAL_OPTIONS: { value: Accidental; label: string }[] = [
  { value: 'sharp', label: '♯ Sharps' },
  { value: 'flat', label: '♭ Flats' },
]

/** Same key as the tuner screen's debug preset (10-tuner-screen). Read-only here. */
const TUNER_PRESET_KEY = 'tunepulse:tuner-preset'
const parseTunerPreset = (v: unknown): TunerPreset | undefined =>
  TUNER_PRESETS.some((p) => p.id === v) ? (v as TunerPreset) : undefined

const REPEAT_MS = 80

export default function SettingsScreen() {
  const { preference, setMode, colors, fonts } = useTheme()
  const { settings, updateSettings } = useTunerSettings()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts])

  const version = Constants.expoConfig?.version ?? '—'
  const versionCode = Constants.expoConfig?.android?.versionCode

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
    >
      <Text style={styles.title}>Settings</Text>

      <Section title="Appearance" styles={styles}>
        <Row label="Theme" hint="System follows the phone setting" styles={styles}>
          <ChipGroup
            options={THEME_OPTIONS}
            value={preference}
            onChange={setMode}
            renderLabel={(o) =>
              o.icon ? [<Icon key="i" name={o.icon} size={13} strokeWidth={1.8} />, o.label] : o.label
            }
          />
        </Row>
      </Section>

      <Section title="Tuner" styles={styles}>
        <Row label="Note notation" styles={styles}>
          <ChipGroup
            options={NOTATION_OPTIONS}
            value={settings.notation}
            onChange={(notation) => updateSettings({ notation })}
          />
        </Row>
        <Row label="Accidentals" hint="Show ♯ or ♭ for the same pitch" styles={styles}>
          <ChipGroup
            options={ACCIDENTAL_OPTIONS}
            value={settings.accidental}
            onChange={(accidental) => updateSettings({ accidental })}
          />
        </Row>
        <Row
          label="Reference pitch"
          hint={`A4 = ${settings.referenceA4} Hz (standard: 440)`}
          styles={styles}
        >
          <A4Control
            value={settings.referenceA4}
            onChange={(referenceA4) => updateSettings({ referenceA4 })}
            styles={styles}
          />
        </Row>
        <Row label="In-tune tolerance" hint="How strict the green zone is" styles={styles}>
          <ChipGroup
            options={TOLERANCE_OPTIONS.map((value) => ({ value, label: `±${value}¢` }))}
            value={settings.inTuneCents}
            onChange={(inTuneCents: InTuneTolerance) => updateSettings({ inTuneCents })}
          />
        </Row>
        <Row label="Instrument" hint="Also changeable in the tuner" styles={styles}>
          <ChipGroup
            options={INSTRUMENTS.map((i) => ({ value: i.id, label: i.name }))}
            value={settings.instrument}
            onChange={(instrument) => updateSettings({ instrument })}
          />
        </Row>
        <Row label="Preview" hint="How an A4 in tune would look" styles={styles}>
          <Text style={styles.preview}>
            {formatNoteName(9, settings.notation, settings.accidental)}
            <Text style={styles.previewMuted}>4 · {settings.referenceA4} Hz</Text>
          </Text>
        </Row>
      </Section>

      <Pressable
        onPress={() => updateSettings(DEFAULT_TUNER_SETTINGS)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
      >
        <Icon name="rotateCcw" size={15} color={colors.muted} />
        <Text style={styles.resetLabel}>Reset tuner settings</Text>
      </Pressable>

      <Section title="About" styles={styles}>
        <View style={styles.row}>
          <Text style={styles.label}>TunePulse</Text>
          <Text style={styles.mono}>
            Version {version}
            {versionCode != null ? ` (${versionCode})` : ''}
          </Text>
          <Text style={styles.hint}>Chromatic tuner and metronome for musicians.</Text>
        </View>
      </Section>

      <Diagnostics styles={styles} />
    </ScrollView>
  )
}

type Styles = ReturnType<typeof makeStyles>

function Section({ title, styles, children }: { title: string; styles: Styles; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  )
}

function Row({
  label,
  hint,
  styles,
  children,
}: {
  label: string
  hint?: string
  styles: Styles
  children: ReactNode
}) {
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.control}>{children}</View>
    </View>
  )
}

function ChipGroup<T extends string | number, O extends { value: T; label: string }>({
  options,
  value,
  onChange,
  renderLabel,
}: {
  options: readonly O[]
  value: T
  onChange: (value: T) => void
  renderLabel?: (option: O) => ReactNode
}) {
  return (
    <View accessibilityRole="radiogroup" style={chipGroupStyles.group}>
      {options.map((o) => (
        <Chip
          key={String(o.value)}
          active={o.value === value}
          onPress={() => onChange(o.value)}
          accessibilityLabel={o.label}
        >
          {renderLabel ? renderLabel(o) : o.label}
        </Chip>
      ))}
    </View>
  )
}

const chipGroupStyles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
})

/** ±1 Hz stepper (hold to repeat) + preset chips, clamped to MIN..MAX. */
function A4Control({
  value,
  onChange,
  styles,
}: {
  value: number
  onChange: (value: number) => void
  styles: Styles
}) {
  const { colors } = useTheme()
  const valueRef = useRef(value)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const stopRepeat = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }, [])
  useEffect(() => stopRepeat, [stopRepeat])

  const step = useCallback(
    (delta: number) => {
      const next = clampReferenceA4(valueRef.current + delta)
      if (next === valueRef.current) {
        stopRepeat()
        return
      }
      valueRef.current = next
      onChange(next)
    },
    [onChange, stopRepeat],
  )

  const startRepeat = useCallback(
    (delta: number) => {
      stopRepeat()
      timer.current = setInterval(() => step(delta), REPEAT_MS)
    },
    [step, stopRepeat],
  )

  const stepButton = (delta: number, icon: IconName, label: string, disabled: boolean) => (
    <Pressable
      onPress={() => step(delta)}
      onLongPress={() => startRepeat(delta)}
      onPressOut={stopRepeat}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [styles.stepBtn, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Icon name={icon} size={16} color={colors.fg} />
    </Pressable>
  )

  return (
    <View style={styles.a4}>
      <View style={styles.stepper}>
        {stepButton(-1, 'minus', 'Lower reference pitch', value <= MIN_REFERENCE_A4)}
        <Text style={styles.stepValue}>{value} Hz</Text>
        {stepButton(1, 'plus', 'Raise reference pitch', value >= MAX_REFERENCE_A4)}
      </View>
      <ChipGroup
        options={REFERENCE_A4_PRESETS.map((hz) => ({ value: hz, label: String(hz) }))}
        value={value}
        onChange={onChange}
      />
      <Text style={styles.hint}>
        The frequency assigned to A above middle C. Most modern music uses 440 Hz; some European
        orchestras prefer 442, early-music ensembles 415.
      </Text>
    </View>
  )
}

type DiagSample = EngineDiagnostics | string | null

/** Snapshot of 11's engine diagnostics; never throws (Settings must not crash on it). */
function readEngineDiagnostics(get: (() => EngineDiagnostics) | undefined): DiagSample {
  if (typeof get !== 'function') return null
  try {
    return get()
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`
  }
}

function formatValue(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3)
  if (typeof v === 'string') return v
  if (v == null) return '—'
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function Diagnostics({ styles }: { styles: Styles }) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  // live:false → no beat-rate re-renders while the metronome plays.
  const { getEngineDiagnostics } = useMetronome({ live: false })
  const [sample, setSample] = useState<DiagSample>(null)
  const [preset] = usePersistentState<TunerPreset>(TUNER_PRESET_KEY, DEFAULT_TUNER_PRESET, parseTunerPreset)

  const refresh = useCallback(() => setSample(readEngineDiagnostics(getEngineDiagnostics)), [getEngineDiagnostics])
  const toggle = () => {
    if (!open) refresh()
    setOpen(!open)
  }

  const presetInfo = TUNER_PRESETS.find((p) => p.id === preset)
  const rows: [string, string][] = [
    ['tuner preset', presetInfo ? `${presetInfo.label} — ${presetInfo.description}` : preset],
  ]
  if (typeof sample === 'string') rows.push(['engine', sample])
  else if (sample) for (const [k, v] of Object.entries(sample)) rows.push([k, formatValue(v)])
  else rows.push(['engine', 'diagnostics unavailable'])

  return (
    <View style={styles.section}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.diagHeader}
      >
        <Text style={styles.eyebrow}>Diagnostics</Text>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="chevronRight" size={14} color={colors.muted} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.card}>
          {rows.map(([k, v]) => (
            <View key={k} style={styles.diagRow}>
              <Text style={styles.diagKey}>{k}</Text>
              <Text style={styles.diagValue}>{v}</Text>
            </View>
          ))}
          <Pressable
            onPress={refresh}
            accessibilityRole="button"
            style={({ pressed }) => [styles.diagRefresh, pressed && styles.pressed]}
          >
            <Icon name="refreshCw" size={13} color={colors.muted} />
            <Text style={styles.diagKey}>Refresh</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

function makeStyles(colors: ThemeColors, fonts: ThemeFonts) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: 24, paddingTop: 16, gap: 28 },
    title: { fontFamily: fonts.display.regular, fontSize: 30, color: colors.fg },
    section: { gap: 10 },
    eyebrow: {
      fontFamily: fonts.mono.medium,
      fontSize: 10,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.muted,
    },
    card: {
      backgroundColor: colors.paper,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      overflow: 'hidden',
    },
    row: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: -StyleSheet.hairlineWidth,
    },
    control: { alignItems: 'flex-start' },
    label: { fontFamily: fonts.sans.medium, fontSize: 14, color: colors.fg },
    hint: { fontFamily: fonts.sans.regular, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
    mono: { fontFamily: fonts.mono.regular, fontSize: 12, color: colors.fgDim, marginTop: 2 },
    preview: { fontFamily: fonts.mono.medium, fontSize: 22, color: colors.fg },
    previewMuted: { fontFamily: fonts.mono.regular, fontSize: 13, color: colors.muted },
    a4: { gap: 12, alignSelf: 'stretch' },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepValue: {
      minWidth: 76,
      textAlign: 'center',
      fontFamily: fonts.mono.medium,
      fontSize: 16,
      fontVariant: ['tabular-nums'],
      color: colors.fg,
    },
    disabled: { opacity: 0.3 },
    pressed: { transform: [{ scale: 0.97 }] },
    reset: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      height: 36,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    resetLabel: { fontFamily: fonts.sans.medium, fontSize: 13, color: colors.muted },
    diagHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
    diagRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    diagKey: { fontFamily: fonts.mono.regular, fontSize: 11, color: colors.muted },
    diagValue: { flexShrink: 1, textAlign: 'right', fontFamily: fonts.mono.regular, fontSize: 11, color: colors.fgDim },
    diagRefresh: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  })
}
