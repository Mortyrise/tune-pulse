const SLOTS = 12
const MAX_CENTS = 50

export type HistorySample = {
  cents: number
}

export type HistoryStripProps = {
  history: HistorySample[]
}

function colorFor(cents: number): string {
  const abs = Math.abs(cents)
  if (abs <= 5) {
    return 'var(--color-good)'
  }
  if (abs <= 15) {
    return 'var(--color-warn)'
  }
  return 'var(--color-bad)'
}

export function HistoryStrip({ history }: HistoryStripProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="font-sans uppercase"
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.2em',
            color: 'var(--color-muted)',
          }}
        >
          Recent
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 9.5,
            color: 'var(--color-muted)',
            letterSpacing: '0.06em',
          }}
        >
          last {SLOTS}
        </span>
      </div>
      <div
        className="relative flex items-center rounded-lg px-1.5"
        style={{
          height: 26,
          border: '0.5px solid var(--color-border)',
        }}
      >
        <div
          className="absolute left-0 right-0 top-1/2"
          style={{
            height: 0.5,
            background: 'var(--color-border-strong)',
          }}
        />
        <div className="flex h-full flex-1 items-center gap-1">
          {Array.from({ length: SLOTS }).map((_, index) => {
            const sample = history[index]
            if (!sample) {
              return (
                <div
                  key={index}
                  className="flex-1 rounded-full opacity-40"
                  style={{
                    height: 3,
                    background: 'var(--color-border-strong)',
                  }}
                />
              )
            }
            const offset = Math.max(-1, Math.min(1, sample.cents / MAX_CENTS))
            const color = colorFor(sample.cents)
            return (
              <div key={index} className="relative h-full flex-1">
                <div
                  className="absolute rounded-full"
                  style={{
                    left: '50%',
                    top: `calc(50% + ${offset * 9}px)`,
                    width: 4,
                    height: 4,
                    background: color,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
