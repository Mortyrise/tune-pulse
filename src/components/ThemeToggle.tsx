import { Contrast, Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from '../hooks/useTheme'

const ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  mono: Contrast,
}

const NEXT_LABEL: Record<Theme, string> = {
  light: 'dark',
  dark: 'mono',
  mono: 'light',
}

export function ThemeToggle() {
  const { theme, cycle } = useTheme()
  const Icon = ICONS[theme]
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Switch to ${NEXT_LABEL[theme]} theme`}
      title={`Theme: ${theme}`}
      className="rounded-full p-2 text-[color:var(--color-muted)] transition hover:text-[color:var(--color-fg)]"
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}
