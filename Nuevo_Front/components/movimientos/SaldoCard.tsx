'use client'

import { useAppStore } from '@/lib/store/appStore'
import { AppIcon } from '@/components/ui/AppIcon'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

export function SaldoCard() {
  const { saldoActual, saldoInicial, totalIngresos, totalEgresos, tipoCaja, arcoAbierto } = useAppStore()

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div>
          <p className="text-sm font-bold text-slate-500">Saldo actual del arqueo</p>
          <p className={`mt-2 break-words text-3xl font-extrabold tracking-tight sm:text-4xl ${saldoActual >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {fmt(saldoActual)}
          </p>
        </div>
        {arcoAbierto && (
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${tipoCaja === 'global' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
            <span className="h-2 w-2 rounded-full bg-current" />
            {tipoCaja === 'global' ? 'Caja Global' : 'Caja Personal'}
          </span>
        )}
      </div>

      {arcoAbierto && (
        <>
          <div className="grid border-y border-slate-200 sm:grid-cols-3">
            <BalanceItem label="Saldo inicial" value={fmt(saldoInicial)} />
            <BalanceItem label="Ingresos" value={`+ ${fmt(totalIngresos)}`} tone="success" />
            <BalanceItem label="Egresos" value={`− ${fmt(totalEgresos)}`} tone="danger" />
          </div>
          <div className="flex items-start gap-2 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:px-6">
            <AppIcon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>El saldo se calcula como saldo inicial + ingresos − egresos.</span>
          </div>
        </>
      )}
    </section>
  )
}

function BalanceItem({ label, value, tone = 'default' }: {
  label: string
  value: string
  tone?: 'default' | 'success' | 'danger'
}) {
  const color = tone === 'success' ? 'text-emerald-700' : tone === 'danger' ? 'text-red-700' : 'text-slate-800'
  return (
    <div className="border-b border-slate-200 px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:px-6">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-base font-extrabold ${color}`}>{value}</p>
    </div>
  )
}
