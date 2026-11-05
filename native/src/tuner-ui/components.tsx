// Small presentational pieces for the tuner screen. Plain RN views, no SVG.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import { TONE_COLORS, centsTone, type HistoryEntry } from './display'

export const COLORS = {
  bg: '#FAF5E5',
  paper: '#EEE7D6',
  fg: '#181816',
  dim: '#3A382F',
  muted: '#8A867A',
  border: 'rgba(24,24,22,0.15)',
  accent: '#C4502F',
  ...TONE_COLORS,
}

// --- chips --------------------------------------------------------------------

export function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
  label,
  scroll,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  label?: (v: T) => string
  scroll?: boolean
}) {
  const chips = options.map((o) => {
    const on = o === value
    return (
      <Pressable
        key={String(o)}
        onPress={() => onChange(o)}
        style={[styles.chip, on && styles.chipOn]}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
      >
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{label ? label(o) : String(o)}</Text>
      </Pressable>
    )
  })
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {chips}
      </ScrollView>
    )
  }
  return <View style={[styles.chipRow, styles.wrap]}>{chips}</View>
}

// --- cents bar ----------------------------------------------------------------

const pct = (cents: number) => `${Math.max(0, Math.min(100, cents + 50))}%` as const

export function CentsBar({
  cents,
  inTuneCents,
  color,
}: {
  cents: number | null
  inTuneCents: number
  color: string
}) {
  return (
    <View>
      <View style={styles.barRow}>
        <Text style={styles.barSign}>♭</Text>
        <View style={styles.bar}>
          <View
            style={[
              styles.barZone,
              { left: pct(-inTuneCents), width: `${inTuneCents * 2}%` },
            ]}
          />
          {[-25, 0, 25].map((c) => (
            <View key={c} style={[styles.barTick, c === 0 && styles.barTickMain, { left: pct(c) }]} />
          ))}
          {cents !== null ? (
            <View style={[styles.needle, { left: pct(cents), backgroundColor: color }]} />
          ) : null}
        </View>
        <Text style={styles.barSign}>♯</Text>
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.small}>−50¢</Text>
        <Text style={styles.small}>−25</Text>
        <Text style={styles.small}>0</Text>
        <Text style={styles.small}>+25</Text>
        <Text style={styles.small}>+50¢</Text>
      </View>
    </View>
  )
}

export function HoldBar({ progress, confirmed }: { progress: number; confirmed: boolean }) {
  return (
    <View style={styles.hold}>
      <View
        style={[
          styles.holdFill,
          { width: `${Math.round(progress * 100)}%`, opacity: confirmed ? 1 : 0.6 },
        ]}
      />
    </View>
  )
}

// --- history strip ------------------------------------------------------------

export function HistoryStrip({
  history,
  max,
  inTuneCents,
}: {
  history: readonly HistoryEntry[]
  max: number
  inTuneCents: number
}) {
  const cells: (HistoryEntry | null)[] = [
    ...Array<null>(Math.max(0, max - history.length)).fill(null),
    ...history.slice(-max),
  ]
  return (
    <View>
      <Text style={styles.caption}>RECENT · LAST {max}</Text>
      <View style={styles.history}>
        {cells.map((h, i) => (
          <View key={i} style={styles.historyCell}>
            {h ? (
              <View
                style={[
                  styles.historyDot,
                  {
                    // up = sharp; ±50¢ maps to ±9 px inside the 26 px row
                    transform: [{ translateY: -(Math.max(-50, Math.min(50, h.cents)) / 50) * 9 }],
                    backgroundColor: TONE_COLORS[centsTone(h.cents, inTuneCents)],
                  },
                ]}
              />
            ) : (
              <View style={styles.historyEmpty} />
            )}
          </View>
        ))}
      </View>
    </View>
  )
}

// --- strings row --------------------------------------------------------------

export function StringRow({
  strings,
  activeIndex,
  inTune,
}: {
  strings: readonly { label: string }[]
  activeIndex: number | null
  inTune: boolean
}) {
  return (
    <View style={styles.strings}>
      {strings.map((s, i) => {
        const on = i === activeIndex
        const bg = on ? (inTune ? COLORS.good : COLORS.accent) : 'transparent'
        return (
          <View key={i} style={[styles.string, on && { backgroundColor: bg, borderColor: bg }]}>
            <Text style={[styles.stringText, on && styles.stringTextOn]}>{s.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

// --- card / collapsible -------------------------------------------------------

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

export function Collapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <View>
      <Pressable onPress={onToggle} hitSlop={8}>
        <Text style={styles.caption}>
          {open ? '▾' : '▸'} {title}
        </Text>
      </Pressable>
      {open ? <View style={styles.collapsibleBody}>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: 6 },
  wrap: { flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: COLORS.fg, borderColor: COLORS.fg },
  chipText: { fontSize: 13, color: COLORS.dim },
  chipTextOn: { color: '#fff', fontWeight: '600' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barSign: { fontSize: 16, color: COLORS.muted, width: 14, textAlign: 'center' },
  bar: {
    flex: 1,
    height: 28,
    backgroundColor: COLORS.paper,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barZone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(74,124,58,0.22)' },
  barTick: { position: 'absolute', top: 8, bottom: 8, width: 1, backgroundColor: COLORS.muted },
  barTickMain: { top: 2, bottom: 2, width: 2, marginLeft: -1, backgroundColor: COLORS.dim },
  needle: { position: 'absolute', top: 0, bottom: 0, width: 6, marginLeft: -3, borderRadius: 3 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 2 },
  small: { fontSize: 10, color: COLORS.muted },

  hold: { height: 6, borderRadius: 3, backgroundColor: COLORS.paper, overflow: 'hidden', marginHorizontal: 22 },
  holdFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.good },

  caption: { fontSize: 10.5, letterSpacing: 1, color: COLORS.muted, marginBottom: 4 },
  history: {
    flexDirection: 'row',
    height: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
  },
  historyCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  historyDot: { width: 7, height: 7, borderRadius: 4 },
  historyEmpty: { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.border },

  strings: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  string: {
    minWidth: 40,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  stringText: { fontSize: 14, color: COLORS.dim, fontWeight: '500' },
  stringTextOn: { color: '#fff', fontWeight: '700' },

  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
  },
  collapsibleBody: { gap: 8, marginTop: 4 },
})
