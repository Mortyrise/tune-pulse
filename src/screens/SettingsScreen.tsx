import { ThemeToggle } from '../components/ThemeToggle'

export function SettingsScreen() {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3">
        <div>
          <p className="text-sm font-medium">Appearance</p>
          <p className="text-xs text-[color:var(--color-muted)]">Light / dark</p>
        </div>
        <ThemeToggle />
      </section>

      <p className="text-xs text-[color:var(--color-muted)]">
        More settings coming soon: note notation (C-D-E / Do-Re-Mi), accidental
        preference, in-tune tolerance, reference pitch.
      </p>
    </div>
  )
}
