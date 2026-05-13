import { describeArc } from './svgGeometry'

const RANGE_CENTS = 50
const IN_TUNE_DEG = 9.6
const NEAR_DEG = 27
const TOP_CENTER_DEG = -90

export type CentsRingProps = {
  cents: number
  active: boolean
  noteLabel: string | null
  /** Sharp/flat glyph next to the note ("♯", "♭", or undefined). */
  accidental?: string | null
  octave?: number | null
  size?: number
  /** 0..1 — fills a green confirmation arc when within ±5¢ over time. */
  holdProgress?: number
}

function centsToColor(cents: number, active: boolean): string {
  if (!active) {
    return 'var(--color-muted)'
  }
  const abs = Math.abs(cents)
  if (abs <= 5) {
    return 'var(--color-good)'
  }
  if (abs <= 15) {
    return 'var(--color-warn)'
  }
  return 'var(--color-bad)'
}

export function CentsRing({
  cents,
  active,
  noteLabel,
  accidental,
  octave,
  size = 290,
  holdProgress = 0,
}: CentsRingProps) {
  const radius = size / 2 - 26
  const clamped = Math.max(-RANGE_CENTS, Math.min(RANGE_CENTS, cents))
  const angleDeg = (clamped / RANGE_CENTS) * 90 + TOP_CENTER_DEG
  const angleRad = (angleDeg * Math.PI) / 180
  const indicatorX = size / 2 + Math.cos(angleRad) * radius
  const indicatorY = size / 2 + Math.sin(angleRad) * radius
  const color = centsToColor(cents, active)

  const markers = [-25, 0, 25]
  const extremes = [-50, 50]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="1"
      />
      <path
        d={describeArc(size / 2, size / 2, radius, -90, 90)}
        fill="none"
        stroke="var(--color-border-strong)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d={describeArc(
          size / 2,
          size / 2,
          radius,
          TOP_CENTER_DEG - IN_TUNE_DEG,
          TOP_CENTER_DEG + IN_TUNE_DEG,
        )}
        fill="none"
        stroke="var(--color-good)"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d={describeArc(
          size / 2,
          size / 2,
          radius,
          TOP_CENTER_DEG - NEAR_DEG,
          TOP_CENTER_DEG + NEAR_DEG,
        )}
        fill="none"
        stroke="var(--color-warn)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />

      {active && holdProgress > 0 && (
        <path
          d={describeArc(
            size / 2,
            size / 2,
            radius,
            TOP_CENTER_DEG - holdProgress * 10,
            TOP_CENTER_DEG + holdProgress * 10,
          )}
          fill="none"
          stroke="var(--color-good)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      )}

      {markers.map((mark) => {
        const ma = (mark / RANGE_CENTS) * 90 + TOP_CENTER_DEG
        const mr = (ma * Math.PI) / 180
        const labelX = size / 2 + Math.cos(mr) * (radius - 14)
        const labelY = size / 2 + Math.sin(mr) * (radius - 14)
        const tickInnerX = size / 2 + Math.cos(mr) * (radius - 6)
        const tickInnerY = size / 2 + Math.sin(mr) * (radius - 6)
        const tickOuterX = size / 2 + Math.cos(mr) * (radius + 4)
        const tickOuterY = size / 2 + Math.sin(mr) * (radius + 4)
        return (
          <g key={mark}>
            <line
              x1={tickInnerX}
              y1={tickInnerY}
              x2={tickOuterX}
              y2={tickOuterY}
              stroke="var(--color-border-strong)"
              strokeWidth="1"
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-mono)"
              fontSize="9"
              fill="var(--color-muted)"
            >
              {mark === 0 ? '0' : mark > 0 ? `+${mark}` : mark}
            </text>
          </g>
        )
      })}

      {extremes.map((mark) => {
        const ma = (mark / RANGE_CENTS) * 90 + TOP_CENTER_DEG
        const mr = (ma * Math.PI) / 180
        const labelX = size / 2 + Math.cos(mr) * (radius + 14)
        const labelY = size / 2 + Math.sin(mr) * (radius + 14)
        return (
          <text
            key={mark}
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill="var(--color-muted)"
          >
            {mark > 0 ? `+${mark}¢` : `${mark}¢`}
          </text>
        )
      })}

      <text
        x={size / 2 - radius - 6}
        y={size / 2 + 4}
        textAnchor="end"
        fontFamily="var(--font-mono)"
        fontSize="11"
        fill="var(--color-muted)"
        opacity="0.7"
      >
        ♭
      </text>
      <text
        x={size / 2 + radius + 6}
        y={size / 2 + 4}
        textAnchor="start"
        fontFamily="var(--font-mono)"
        fontSize="11"
        fill="var(--color-muted)"
        opacity="0.7"
      >
        ♯
      </text>

      {active && (
        <g>
          <circle cx={indicatorX} cy={indicatorY} r="18" fill={color} fillOpacity="0.12" />
          <circle cx={indicatorX} cy={indicatorY} r="8" fill={color} />
          <line
            x1={size / 2}
            y1={size / 2 + radius * 0.18}
            x2={indicatorX}
            y2={indicatorY}
            stroke={color}
            strokeWidth="1.2"
            strokeOpacity="0.4"
          />
        </g>
      )}

      <text
        x={size / 2}
        y={size / 2 + 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-display)"
        fontWeight="300"
        fontSize="88"
        fill={active ? 'var(--color-fg)' : 'var(--color-muted)'}
        style={{ letterSpacing: '-0.05em' }}
      >
        {noteLabel ?? '—'}
      </text>
      {active && accidental && (
        <text
          x={size / 2 + 32}
          y={size / 2 - 6}
          textAnchor="start"
          dominantBaseline="middle"
          fontFamily="var(--font-display)"
          fontSize="34"
          fill="var(--color-accent)"
        >
          {accidental}
        </text>
      )}
      {octave !== null && octave !== undefined && (
        <text
          x={size / 2}
          y={size / 2 + 54}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="11"
          fill="var(--color-muted)"
          style={{ letterSpacing: '0.18em' }}
        >
          OCT {octave}
        </text>
      )}
    </svg>
  )
}
