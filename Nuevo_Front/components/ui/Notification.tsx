'use client'

// ─── Componente: Notificación tipo toast ─────────────────────────────────────

import { useEffect, useState } from 'react'

export type NotifType = 'success' | 'error' | 'warning' | 'info'

interface Props {
  message: string
  type?: NotifType
  duration?: number
  onClose: () => void
}

const COLORS: Record<NotifType, string> = {
  success: 'bg-emerald-500',
  error:   'bg-red-500',
  warning: 'bg-amber-500',
  info:    'bg-blue-500',
}

const ICONS: Record<NotifType, string> = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
}

export function Notification({ message, type = 'success', duration = 3500, onClose }: Props) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onClose() }, duration)
    return () => clearTimeout(t)
  }, [duration, onClose])

  if (!visible) return null

  return (
    <div
      className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-white font-medium text-sm max-w-sm animate-[fadeIn_0.3s_ease] ${COLORS[type]}`}
    >
      <span>{ICONS[type]}</span>
      <span>{message}</span>
      <button onClick={() => { setVisible(false); onClose() }} className="ml-auto opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>
  )
}

// Hook conveniente para mostrar notificaciones
import { useCallback } from 'react'
import { createRoot } from 'react-dom/client'

export function useNotification() {
  const show = useCallback((message: string, type: NotifType = 'success') => {
    if (typeof window === 'undefined') return
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(
      <Notification
        message={message}
        type={type}
        onClose={() => {
          root.unmount()
          container.remove()
        }}
      />
    )
  }, [])

  return { show }
}
