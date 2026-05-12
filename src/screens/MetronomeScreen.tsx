export function MetronomeScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-widest text-[color:var(--color-muted)]">
        Metronome
      </p>
      <p className="mt-8 font-mono text-7xl font-light tabular-nums">100</p>
      <p className="mt-2 text-sm text-[color:var(--color-muted)]">BPM · 4/4</p>
    </div>
  )
}
