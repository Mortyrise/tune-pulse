import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import type { Subdivision } from '../audio/metronome'
import { MAX_NUMERATOR, MIN_NUMERATOR, useMetronome } from '../hooks/useMetronome'

const BPM_STEPS = [-10, -1, 1, 10]
const SUBDIVISIONS: Subdivision[] = [1, 2, 3, 4]
const NUMERATORS = Array.from({ length: MAX_NUMERATOR - MIN_NUMERATOR + 1 }, (_, i) => MIN_NUMERATOR + i)

/** Keeps running when the tab is hidden (`active` only gates UI beat polling). */
export default function MetronomeScreen({ active = true }: { active?: boolean }) {
  const m = useMetronome({ uiActive: active })
  const { config, activeBeat, debug } = m
  const subdivision = config.beats.subdivisions[0] ?? 1

  return (
    <View style={styles.root}>
      <Text style={styles.bpm}>{config.bpm} BPM</Text>
      <View style={styles.row}>
        {BPM_STEPS.map((d) => (
          <Pressable key={d} style={styles.chip} onPress={() => m.setBpm(config.bpm + d)}>
            <Text>{d > 0 ? `+${d}` : d}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Beats per bar</Text>
      <View style={styles.row}>
        {NUMERATORS.map((n) => (
          <Pressable
            key={n}
            style={[styles.chip, config.numerator === n && styles.chipOn]}
            onPress={() => m.setNumerator(n)}
          >
            <Text style={config.numerator === n ? styles.chipTextOn : undefined}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Subdivision</Text>
      <View style={styles.row}>
        {SUBDIVISIONS.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, subdivision === s && styles.chipOn]}
            onPress={() => m.setSubdivision(s)}
          >
            <Text style={subdivision === s ? styles.chipTextOn : undefined}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text>Accent beat 1</Text>
        <Switch value={config.beats.accents.includes(1)} onValueChange={m.setAccent} />
      </View>
      <View style={styles.switchRow}>
        <Text>Haptic on downbeat</Text>
        <Switch value={config.hapticMode} onValueChange={m.setHaptics} />
      </View>

      <Pressable style={[styles.button, m.isRunning && styles.buttonStop]} onPress={m.toggle}>
        <Text style={styles.buttonText}>{m.isRunning ? 'Stop' : 'Start'}</Text>
      </Pressable>

      <View style={styles.row}>
        {Array.from({ length: config.numerator }, (_, i) => {
          const on = activeBeat?.beat === i + 1
          return <View key={i} style={[styles.dot, on && (i === 0 ? styles.dotAccent : styles.dotOn)]} />
        })}
      </View>
      <Text style={styles.sub}>
        {activeBeat ? `beat ${activeBeat.beat}.${activeBeat.subdivision + 1}` : '-'}
      </Text>

      {m.error ? <Text style={styles.error}>{m.error}</Text> : null}
      <Text style={styles.debug}>
        ctx: {debug.contextState} | {debug.sampleRate} Hz | mode: {debug.mode} | bg:{' '}
        {debug.background ? 'on' : 'off'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 10, alignItems: 'center' },
  bpm: { fontSize: 40, fontWeight: '700' },
  label: { marginTop: 6, color: '#555' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#999', borderRadius: 6 },
  chipOn: { backgroundColor: '#000', borderColor: '#000' },
  chipTextOn: { color: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { marginVertical: 8, paddingVertical: 14, paddingHorizontal: 48, backgroundColor: '#1a9e3a', borderRadius: 8 },
  buttonStop: { backgroundColor: '#d33' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#ddd' },
  dotOn: { backgroundColor: '#333' },
  dotAccent: { backgroundColor: '#d33' },
  sub: { color: '#555' },
  error: { color: '#d33' },
  debug: { marginTop: 'auto', fontSize: 12, color: '#666', fontFamily: 'monospace' },
})
