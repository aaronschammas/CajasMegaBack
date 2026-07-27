// ─── Componente: Badge ────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'gray'
  className?: string
}

const VARIANTS = {
  success: 'bg-emerald-100 text-emerald-700',
  danger:  'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info:    'bg-blue-100 text-blue-700',
  gray:    'bg-gray-100 text-gray-600',
}

export function Badge({ children, variant = 'info', className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  )
}
