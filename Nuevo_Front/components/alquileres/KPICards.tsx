'use client'

// ─── KPI Cards del módulo de alquileres ──────────────────────────────────────

import { ResumenKPIs } from '@/types/alquiler'
import { fmt } from './helpers'

interface Props {
  kpis: ResumenKPIs | null
  loading?: boolean
}

export function KPICards({ kpis, loading }: Props) {
  const cards = [
    {
      label:   'Ingreso Anual Proyectado',
      value:   kpis ? fmt(kpis.ingreso_anual_proyectado) : '—',
      sub:     'Proyección 12 meses',
      icon:    '📈',
      color:   'border-emerald-200 bg-emerald-50',
      text:    'text-emerald-700',
    },
    {
      label:   'Deuda Total',
      value:   kpis ? fmt(kpis.deuda_total) : '—',
      sub:     kpis ? `${kpis.meses_pendientes_total} meses pendientes` : '—',
      icon:    '⚠️',
      color:   'border-red-200 bg-red-50',
      text:    'text-red-600',
    },
    {
      label:   'Ocupación',
      value:   kpis ? `${Math.round(kpis.tasa_ocupacion)}%` : '—',
      sub:     kpis ? `${kpis.propiedades_ocupadas} de ${kpis.total_propiedades} ocupadas` : '—',
      icon:    '🏢',
      color:   'border-blue-200 bg-blue-50',
      text:    'text-blue-700',
    },
    {
      label:   'Pagos Atrasados',
      value:   kpis ? String(kpis.pagos_atrasados) : '—',
      sub:     kpis ? `${kpis.propiedades_con_atraso} propiedades afectadas` : '—',
      icon:    '🔔',
      color:   'border-amber-200 bg-amber-50',
      text:    'text-amber-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-2xl border-2 ${c.color} p-4`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{c.icon}</span>
            <p className="text-xs font-medium text-gray-500">{c.label}</p>
          </div>
          {loading ? (
            <div className="h-8 bg-gray-200 rounded animate-pulse w-24 mb-1" />
          ) : (
            <p className={`text-2xl font-bold ${c.text}`}>{c.value}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">{loading ? '…' : c.sub}</p>
        </div>
      ))}
    </div>
  )
}
