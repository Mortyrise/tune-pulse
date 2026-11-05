// Lucide icons (ISC licence, lucide-react 1.14) transcribed to react-native-svg,
// limited to the ones the web screens use. Same 24×24 geometry as the web.
import { createContext, useContext, type ReactNode } from 'react'
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import { useTheme } from '../theme'

const BOOKMARK =
  'M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z'

const ICONS = {
  audioWaveform: () => (
    <Path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2" />
  ),
  timer: () => (
    <>
      <Line x1="10" x2="14" y1="2" y2="2" />
      <Line x1="12" x2="15" y1="14" y2="11" />
      <Circle cx="12" cy="14" r="8" />
    </>
  ),
  sun: () => (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2" />
      <Path d="M12 20v2" />
      <Path d="m4.93 4.93 1.41 1.41" />
      <Path d="m17.66 17.66 1.41 1.41" />
      <Path d="M2 12h2" />
      <Path d="M20 12h2" />
      <Path d="m6.34 17.66-1.41 1.41" />
      <Path d="m19.07 4.93-1.41 1.41" />
    </>
  ),
  moon: () => (
    <Path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
  ),
  contrast: () => (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 18a6 6 0 0 0 0-12v12z" />
    </>
  ),
  minus: () => <Path d="M5 12h14" />,
  plus: () => (
    <>
      <Path d="M5 12h14" />
      <Path d="M12 5v14" />
    </>
  ),
  rotateCcw: () => (
    <>
      <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <Path d="M3 3v5h5" />
    </>
  ),
  check: () => <Path d="M20 6 9 17l-5-5" />,
  chevronRight: () => <Path d="m9 18 6-6-6-6" />,
  chevronLeft: () => <Path d="m15 18-6-6 6-6" />,
  mic: () => (
    <>
      <Path d="M12 19v3" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Rect x="9" y="2" width="6" height="13" rx="3" />
    </>
  ),
  micOff: () => (
    <>
      <Path d="M12 19v3" />
      <Path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <Path d="M16.95 16.95A7 7 0 0 1 5 12v-2" />
      <Path d="M18.89 13.23A7 7 0 0 0 19 12v-2" />
      <Path d="m2 2 20 20" />
      <Path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    </>
  ),
  refreshCw: () => (
    <>
      <Path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <Path d="M21 3v5h-5" />
      <Path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <Path d="M8 16H3v5" />
    </>
  ),
  settings: () => (
    <>
      <Path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  bookmark: () => <Path d={BOOKMARK} />,
  bookmarkPlus: () => (
    <>
      <Path d="M12 7v6" />
      <Path d="M15 10H9" />
      <Path d={BOOKMARK} />
    </>
  ),
  hand: () => (
    <>
      <Path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <Path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
      <Path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
      <Path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </>
  ),
  pause: () => (
    <>
      <Rect x="14" y="3" width="5" height="18" rx="1" />
      <Rect x="5" y="3" width="5" height="18" rx="1" />
    </>
  ),
  play: () => (
    <Path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
  ),
  vibrate: () => (
    <>
      <Path d="m2 8 2 2-2 2 2 2-2 2" />
      <Path d="m22 8-2 2 2 2-2 2 2 2" />
      <Rect width="8" height="14" x="8" y="5" rx="1" />
    </>
  ),
  volume2: () => (
    <>
      <Path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <Path d="M16 9a5 5 0 0 1 0 6" />
      <Path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
    </>
  ),
  x: () => (
    <>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </>
  ),
} satisfies Record<string, () => ReactNode>

export type IconName = keyof typeof ICONS

export const ICON_NAMES = Object.keys(ICONS) as IconName[]

/**
 * Colour icons inherit when no `color` is passed — the web's `currentColor`.
 * Chip provides its text colour; screens may provide their own.
 */
export const IconColorContext = createContext<string | null>(null)

export type IconProps = {
  name: IconName
  size?: number
  strokeWidth?: number
  color?: string
  /** Fill the shape with the stroke colour (e.g. a solid play/pause button). */
  fill?: boolean
}

export function Icon({ name, size = 24, strokeWidth = 2, color, fill = false }: IconProps) {
  const { colors } = useTheme()
  const inherited = useContext(IconColorContext)
  const stroke = color ?? inherited ?? colors.fg
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? stroke : 'none'}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]()}
    </Svg>
  )
}
