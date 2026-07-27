'use client'

import { useAppStore } from '@/lib/store/appStore'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

export function SaldoCard() {
  const { saldoActual, saldoInicial, totalIngresos, totalEgresos, tipoCaja, arcoAbierto } = useAppStore()

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm text-gray-500 font-medium">Saldo Actual del Arco</p>
        {arcoAbierto && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
            ${tipoCaja === 'global'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-blue-100 text-blue-700'}`}
          >
            {tipoCaja === 'global' ? 'Caja Global' : 'Caja Personal'}
          </span>
        )}
      </div>

      <p className={`text-4xl font-bold tracking-tight ${saldoActual >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {fmt(saldoActual)}
      </p>

      {arcoAbierto && (
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <span className="text-indigo-600">
            Inicial: <strong>{fmt(saldoInicial)}</strong>
          </span>
          <span className="text-emerald-600">
            + Ingresos: <strong>{fmt(totalIngresos)}</strong>
          </span>
          <span className="text-red-500">
            - Egresos: <strong>{fmt(totalEgresos)}</strong>
          </span>
        </div>
      )}
    </div>
  )
}
