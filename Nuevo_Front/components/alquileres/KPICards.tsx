'use client'

import { ResumenKPIs } from '@/types/alquiler'
import { fmt } from './helpers'
import { AppIcon, AppIconName } from '@/components/ui/AppIcon'

interface Props {
  kpis: ResumenKPIs | null
  loading?: boolean
}

export function KPICards({ kpis, loading }: Props) {
  const cards: Array<{
    label: string
    value: string
    sub: string
    icon: AppIconName
    border: string
    iconStyle: string
  }> = [
    {
      label: 'Ingreso anual proyectado',
      value: kpis ? fmt(kpis.ingreso_anual_proyectado) : '—',
      sub: 'Proyección a 12 meses',
      icon: 'chart',
      border: 'border-t-blue-600',
      iconStyle: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Deuda total',
      value: kpis ? fmt(kpis.deuda_total) : '—',
      sub: kpis ? `${kpis.meses_pendientes_total} meses pendientes` : '—',
      icon: 'alert',
      border: 'border-t-red-600',
      iconStyle: 'bg-red-50 text-red-700',
    },
    {
      label: 'Ocupación',
      value: kpis ? `${Math.round(kpis.tasa_ocupacion)}%` : '—',
      sub: kpis ? `${kpis.propiedades_ocupadas} de ${kpis.total_propiedades} ocupadas` : '—',
      icon: 'building',
      border: 'border-t-emerald-600',
      iconStyle: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Pagos atrasados',
      value: kpis ? String(kpis.pagos_atrasados) : '—',
      sub: kpis ? `${kpis.propiedades_con_atraso} propiedades afectadas` : '—',
      icon: 'clock',
      border: 'border-t-amber-500',
      iconStyle: 'bg-amber-50 text-amber-700',
    },
  ]

  return (
    <section className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Indicadores de alquileres">
      {cards.map((card) => (
        <article key={card.label} className={`surface-card min-w-0 border-t-4 p-4 sm:p-5 ${card.border}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 sm:text-sm">{card.label}</p>
            <span className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid ${card.iconStyle}`}>
              <AppIcon name={card.icon} className="h-5 w-5" />
            </span>
          </div>
          {loading ? (
            <div className="my-3 h-8 w-3/4 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-3 break-words text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{card.value}</p>
          )}
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{loading ? 'Cargando…' : card.sub}</p>
        </article>
      ))}
    </section>
  )
}
