// Hidden device-testing panel (long-press the top-bar label): preset chips + live detector stats.
import { StyleSheet, Text, View } from 'react-native'
import { Chip } from '../components/atoms/Chip'
import { TUNER_PRESETS, type TunerPreset } from '../audio/tuner'
import type { TunerDebug } from '../hooks/useTuner'
import { useTheme } from '../theme'

type RawSample = { frequency: number; clarity: number; rms: number }

export function DebugPanel({
  preset,
  onPreset,
  status,
  debug,
  sample,
}: {
  preset: TunerPreset
  onPreset: (p: TunerPreset) => void
  status: string
  debug: TunerDebug | null
  sample: RawSample | null
}) {
  const { colors, fonts } = useTheme()
  const info = TUNER_PRESETS.find((p) => p.id === preset)
  return (
    <View style={[styles.panel, { borderColor: colors.borderStrong, backgroundColor: colors.paper }]}>
      <View style={styles.chips}>
        {TUNER_PRESETS.map((p) => (
          <Chip key={p.id} active={p.id === preset} onPress={() => onPreset(p.id)}>
            {p.label}
          </Chip>
        ))}
      </View>
      {info ? <Text style={[styles.text, { color: colors.muted, fontFamily: fonts.mono.regular }]}>{info.description}</Text> : null}
      <Text style={[styles.text, { color: colors.fgDim, fontFamily: fonts.mono.regular }]}>
        {debugText(status, debug, sample)}
      </Text>
    </View>
  )
}

export function debugText(status: string, debug: TunerDebug | null, sample: RawSample | null): string {
  const raw = sample
    ? `out ${sample.frequency > 0 ? sample.frequency.toFixed(2) : '—'} Hz | clarity ${sample.clarity.toFixed(2)} | rms ${sample.rms.toFixed(4)}`
    : 'out —'
  if (!debug) return `status: ${status}\n${raw}`
  const lines = [
    `${debug.preset} | sr ${debug.sampleRate} (device ${debug.deviceSampleRate || '?'}) | buf ${debug.bufferSize} | win ${debug.windowSize} | lp ${debug.lowpassHz || 'off'} | gate ${debug.rmsThreshold}`,
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
  lines.push(`voiced ${debug.voiced} | rej gate ${debug.rejGate} | clarity ${debug.rejClarity} | nopeak ${debug.rejNoPeak}`)
  if (debug.lastError) lines.push(`last error: ${debug.lastError}`)
  return lines.join('\n')
}

const styles = StyleSheet.create({
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 8 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  text: { fontSize: 10, lineHeight: 15 },
})
