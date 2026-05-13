import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  children: ReactNode
}

export function Chip({ active = false, children, className = '', style, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 transition active:scale-[0.97] ${className}`}
      style={{
        height: 30,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.02em',
        background: active ? 'var(--color-fg)' : 'transparent',
        color: active ? 'var(--color-bg)' : 'var(--color-fg-dim)',
        border: `0.5px solid ${active ? 'var(--color-fg)' : 'var(--color-border-strong)'}`,
        ...style,
      }}
    >
      {children}
    </button>
  )
}
