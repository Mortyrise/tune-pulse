import { Minus, Plus, RotateCcw } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'
import {
  MAX_REFERENCE_A4,
  MIN_REFERENCE_A4,
  TOLERANCE_OPTIONS,
  useTunerSettings,
  type InTuneTolerance,
} from '../hooks/useTunerSettings'
import { formatNoteName, type Accidental, type Notation } from '../lib/notes'

const NOTATION_OPTIONS: { value: Notation; label: string; sample: string }[] = [
  { value: 'english', label: 'C-D-E', sample: 'A' },
  { value: 'latin', label: 'Do-Re-Mi', sample: 'La' },
]

const ACCIDENTAL_OPTIONS: { value: Accidental; label: string }[] = [
  { value: 'sharp', label: '♯ Sharps' },
  { value: 'flat', label: '♭ Flats' },
]

export function SettingsScreen() {
  const { settings, updateSettings, resetSettings } = useTunerSettings()

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Section title="Appearance">
        <Row label="Theme" hint="Light or dark">
          <ThemeToggle />
        </Row>
      </Section>

      <Section title="Tuner">
        <Row label="Note notation">
          <SegmentedControl
            options={NOTATION_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={settings.notation}
            onChange={(value) => updateSettings({ notation: value })}
          />
        </Row>

        <Row label="Accidentals" hint="Show ♯ or ♭ for the same pitch">
          <SegmentedControl
            options={ACCIDENTAL_OPTIONS}
            value={settings.accidental}
            onChange={(value) => updateSettings({ accidental: value })}
          />
        </Row>

        <Row
          label="Reference pitch"
          hint={`A${4} = ${settings.referenceA4} Hz (standard: 440)`}
        >
          <ReferencePitchStepper
            value={settings.referenceA4}
            onChange={(value) => updateSettings({ referenceA4: value })}
          />
        </Row>

        <Row label="In-tune tolerance" hint="How strict the green zone is">
          <SegmentedControl
            options={TOLERANCE_OPTIONS.map((value) => ({
              value,
              label: `±${value}¢`,
            }))}
            value={settings.inTuneCents}
            onChange={(value: InTuneTolerance) => updateSettings({ inTuneCents: value })}
          />
        </Row>

        <Row label="Preview" hint="How an A4 in tune would look">
          <span className="font-mono text-xl tabular-nums">
            {formatNoteName(9, settings.notation, settings.accidental)}
            <span className="ml-1 text-sm text-[color:var(--color-muted)]">4</span>
          </span>
        </Row>
      </Section>

      <button
        type="button"
        onClick={resetSettings}
        className="flex items-center justify-center gap-2 self-start rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm text-[color:var(--color-muted)] transition hover:text-[color:var(--color-fg)]"
      >
        <RotateCcw className="h-4 w-4" />
        Reset tuner settings
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
        {title}
      </h2>
      <div className="flex flex-col divide-y divide-[color:var(--color-border)] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        {children}
      </div>
    </section>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-[color:var(--color-muted)]">{hint}</span>}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  )
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="radiogroup"
      className="flex items-center rounded-full border border-[color:var(--color-border)] p-1"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className="rounded-full px-3 py-1.5 text-xs font-medium transition"
            style={{
              backgroundColor: selected ? 'var(--color-fg)' : 'transparent',
              color: selected ? 'var(--color-bg)' : 'var(--color-muted)',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function ReferencePitchStepper({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= MIN_REFERENCE_A4}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border)] disabled:opacity-30"
        aria-label="Lower reference pitch"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-16 text-center font-mono text-base tabular-nums">{value} Hz</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_REFERENCE_A4}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border)] disabled:opacity-30"
        aria-label="Raise reference pitch"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
