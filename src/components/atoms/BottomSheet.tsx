import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex-1"
        style={{
          background: 'rgba(0,0,0,0.42)',
          animation: 'pg-fade-in 180ms ease',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="mx-auto w-full max-w-2xl px-5 pb-7 pt-3.5"
        style={{
          background: 'var(--color-paper)',
          borderTop: '0.5px solid var(--color-border-strong)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 'calc(28px + env(safe-area-inset-bottom))',
          animation: 'pg-slide-up 220ms cubic-bezier(.2,.9,.3,1)',
        }}
      >
        <div
          className="mx-auto rounded-full"
          style={{
            width: 36,
            height: 4,
            background: 'var(--color-border-strong)',
            marginBottom: 14,
          }}
        />
        <div className="mb-3.5 flex items-center justify-between">
          <span
            className="font-sans uppercase"
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '0.2em',
              color: 'var(--color-muted)',
            }}
          >
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3"
            style={{
              height: 26,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.02em',
              background: 'transparent',
              color: 'var(--color-fg-dim)',
              border: '0.5px solid var(--color-border-strong)',
            }}
          >
            Done
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
