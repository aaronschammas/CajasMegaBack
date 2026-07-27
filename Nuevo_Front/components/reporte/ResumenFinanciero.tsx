'use client'

import { AppIcon, AppIconName } from '@/components/ui/AppIcon'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

interface Props {
  saldoInicial: number
  totalIngresos: number
  totalEgresos: number
  saldoFinal: number
  retiro?: number
}

export function ResumenFinanciero({ saldoInicial, totalIngresos, totalEgresos, saldoFinal, retiro = 0 }: Props) {
  const cards: Array<{
    label: string
    value: number
    icon: AppIconName
    border: string
    iconStyle: string
    wide?: boolean
  }> = [
    { label: 'Saldo Inicial', value: saldoInicial, icon: 'wallet', border: 'border-t-indigo-500', iconStyle: 'bg-indigo-50 text-indigo-700' },
    { label: 'Total Ingresos', value: totalIngresos, icon: 'income', border: 'border-t-emerald-600', iconStyle: 'bg-emerald-50 text-emerald-700' },
    { label: 'Total Egresos', value: totalEgresos, icon: 'expense', border: 'border-t-red-600', iconStyle: 'bg-red-50 text-red-700' },
    { label: 'Retiros', value: retiro, icon: 'logout', border: 'border-t-amber-500', iconStyle: 'bg-amber-50 text-amber-700' },
    { label: 'Saldo Final', value: saldoFinal, icon: 'chart', border: 'border-t-blue-600', iconStyle: 'bg-blue-50 text-blue-700', wide: true },
  ]

  return (
    <section className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4" aria-label="Resumen financiero">
      {cards.map((card) => (
        <article key={card.label} className={`surface-card min-w-0 border-t-4 p-4 ${card.border} ${card.wide ? 'col-span-2 md:col-span-4' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className={`mt-2 break-words font-extrabold tracking-tight text-slate-900 ${card.wide ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-2xl'}`}>{fmt(card.value)}</p>
            </div>
            <span className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid ${card.iconStyle}`}>
              <AppIcon name={card.icon} className="h-5 w-5" />
            </span>
          </div>
        </article>
      ))}
    </section>
  )
}
