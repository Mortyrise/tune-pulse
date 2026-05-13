import { NavLink } from 'react-router'
import { AudioWaveform, Timer } from 'lucide-react'

const TABS = [
  { to: '/', label: 'Tuner', icon: AudioWaveform },
  { to: '/metronome', label: 'Metronome', icon: Timer },
] as const

export function TabBar() {
  return (
    <nav
      className="relative z-[2]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        className="mx-auto mb-6 mt-2 flex gap-1 p-1"
        style={{
          maxWidth: 380,
          background: 'var(--color-paper)',
          border: '0.5px solid var(--color-border-strong)',
          borderRadius: 14,
          marginInline: 18,
        }}
      >
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex flex-1 items-center justify-center gap-2 rounded-[10px] px-2 py-2.5 transition',
                isActive ? '' : 'hover:text-[color:var(--color-fg)]',
              ].join(' ')
            }
            style={({ isActive }) => ({
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: '0.02em',
              color: isActive ? 'var(--color-fg)' : 'var(--color-muted)',
              background: isActive ? 'var(--color-bg)' : 'transparent',
              boxShadow: isActive ? 'inset 0 0 0 0.5px var(--color-border-strong)' : 'none',
            })}
          >
            <Icon size={15} strokeWidth={1.6} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
