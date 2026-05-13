import { useCallback, useRef, type PointerEvent, type ReactNode } from 'react'

const SWEEP_DEGREES = 270
const START_ANGLE = -135
const TICK_COUNT = 60

export type DialProps = {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  size?: number
  isRunning?: boolean
  children?: ReactNode
}

type DragState = {
  startAngle: number
  startValue: number
}

export function Dial({ value, min, max, onChange, size = 270, isRunning, children }: DialProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef<DragState | null>(null)

  const percent = (value - min) / (max - min)
  const indicatorAngle = START_ANGLE + percent * SWEEP_DEGREES

  const angleFromEvent = useCallback((event: PointerEvent<HTMLDivElement> | globalThis.PointerEvent) => {
    const el = ref.current
    if (!el) {
      return 0
    }
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const x = event.clientX - cx
    const y = event.clientY - cy
    return Math.atan2(x, -y) * (180 / Math.PI)
  }, [])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.pg-no-drag')) {
      return
    }
    event.preventDefault()
    dragging.current = {
      startAngle: angleFromEvent(event),
      startValue: value,
    }
    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      if (!dragging.current) {
        return
      }
      let delta = angleFromEvent(moveEvent) - dragging.current.startAngle
      if (delta > 180) {
        delta -= 360
      }
      if (delta < -180) {
        delta += 360
      }
      const valueDelta = (delta / SWEEP_DEGREES) * (max - min)
      const next = Math.round(dragging.current.startValue + valueDelta)
      onChange(Math.max(min, Math.min(max, next)))
    }
    const handleUp = () => {
      dragging.current = null
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const ticks: ReactNode[] = []
  const scaleNumbers: ReactNode[] = []

  for (let i = 0; i < TICK_COUNT; i++) {
    const t = i / (TICK_COUNT - 1)
    const angleRad = ((START_ANGLE + t * SWEEP_DEGREES) * Math.PI) / 180
    const isMajor = i % 10 === 0
    const innerR = size / 2 - (isMajor ? 14 : 10)
    const outerR = size / 2 - (isMajor ? 4 : 6)
    const x1 = size / 2 + Math.sin(angleRad) * innerR
    const y1 = size / 2 - Math.cos(angleRad) * innerR
    const x2 = size / 2 + Math.sin(angleRad) * outerR
    const y2 = size / 2 - Math.cos(angleRad) * outerR
    const isActive = t <= percent
    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isActive ? 'var(--color-accent)' : 'var(--color-border-strong)'}
        strokeWidth={isMajor ? 1.5 : 1}
        strokeLinecap="round"
        opacity={isActive ? (isMajor ? 1 : 0.85) : 0.55}
      />,
    )
    if (isMajor && i > 0 && i < TICK_COUNT - 1) {
      const labelValue = Math.round(min + t * (max - min))
      const labelR = size / 2 - 24
      const lx = size / 2 + Math.sin(angleRad) * labelR
      const ly = size / 2 - Math.cos(angleRad) * labelR
      scaleNumbers.push(
        <text
          key={`label-${i}`}
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="var(--color-muted)"
          opacity="0.7"
        >
          {labelValue}
        </text>,
      )
    }
  }

  const knobAngleRad = (indicatorAngle * Math.PI) / 180
  const knobR = size / 2 - 9
  const kx = size / 2 + Math.sin(knobAngleRad) * knobR
  const ky = size / 2 - Math.cos(knobAngleRad) * knobR

  return (
    <div
      ref={ref}
      onPointerDown={handlePointerDown}
      className="relative select-none"
      style={{
        width: size,
        height: size,
        touchAction: 'none',
        cursor: 'grab',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        <defs>
          <radialGradient id="dial-glow" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="var(--color-accent)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {isRunning && (
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 16} fill="url(#dial-glow)" />
        )}
        {ticks}
        {scaleNumbers}
        <g transform={`translate(${kx}, ${ky}) rotate(${indicatorAngle})`}>
          <circle cx="0" cy="0" r="8" fill="var(--color-accent)" fillOpacity="0.18" />
          <circle cx="0" cy="0" r="3.5" fill="var(--color-accent)" />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}
