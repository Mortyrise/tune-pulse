import { NavLink } from 'react-router'
import { AudioWaveform, Settings, Timer } from 'lucide-react'

const TABS = [
  { to: '/', label: 'Tuner', icon: AudioWaveform },
  { to: '/metronome', label: 'Metronome', icon: Timer },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export function TabBar() {
  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center gap-1 py-3 text-xs transition',
                  isActive
                    ? 'text-[color:var(--color-fg)]'
                    : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]',
                ].join(' ')
              }
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
