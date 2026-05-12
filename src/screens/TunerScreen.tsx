export function TunerScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-widest text-[color:var(--color-muted)]">
        Chromatic Tuner
      </p>
      <p className="mt-8 font-mono text-7xl font-light tabular-nums">—</p>
      <p className="mt-2 text-sm text-[color:var(--color-muted)]">
        Tap to enable microphone
      </p>
    </div>
  )
}
