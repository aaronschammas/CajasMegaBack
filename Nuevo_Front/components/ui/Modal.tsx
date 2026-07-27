'use client'

// ─── Componente: Modal genérico ───────────────────────────────────────────────

import { useEffect, ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
  headerClass?: string
}

export function Modal({
  open, onClose, title, children, footer,
  maxWidth = 'max-w-lg',
  headerClass = 'bg-gradient-to-r from-blue-600 to-blue-700',
}: Props) {
  // Cerrar con Escape y bloquear scroll
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} animate-[slideUp_0.25s_ease]`}>
        {title && (
          <div className={`${headerClass} text-white rounded-t-2xl px-6 py-4 flex items-center gap-3`}>
            {typeof title === 'string'
              ? <h3 className="text-lg font-semibold m-0">{title}</h3>
              : title}
          </div>
        )}
        <div className="p-6">{children}</div>
        {footer && (
          <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
