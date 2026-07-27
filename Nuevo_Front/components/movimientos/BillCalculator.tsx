'use client'

import { DENOMINACIONES, useBillCalculator } from '@/lib/hooks/useBillCalculator'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

interface Props {
  calculator: ReturnType<typeof useBillCalculator>
  saldoSistema?: number
  totalLabel?: string
}

export function BillCalculator({ calculator, saldoSistema, totalLabel = 'Total contado' }: Props) {
  const { bills, total, set, increment, decrement } = calculator
  const diferencia = saldoSistema !== undefined ? total - saldoSistema : null

  const formula = [
    ...DENOMINACIONES.map((denom) => `$${new Intl.NumberFormat('es-AR').format(denom)} x ${bills[denom] ?? 0}`),
    `Resto ${fmt(bills.resto ?? 0)}`,
  ].join(' + ')

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {DENOMINACIONES.map((denom) => {
          const subtotal = denom * (bills[denom] ?? 0)
          return (
            <div key={denom} className="flex items-center gap-3 py-2 border-b border-gray-100">
              <div className="flex items-center gap-2 w-28 shrink-0">
                <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-bold">
                  $
                </span>
                <span className="font-semibold text-sm text-gray-700">
                  ${new Intl.NumberFormat('es-AR').format(denom)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => decrement(String(denom))}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold transition-colors"
                  aria-label={`Restar billete de ${denom}`}
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  value={bills[denom] ?? 0}
                  onChange={(e) => set(String(denom), parseInt(e.target.value, 10) || 0)}
                  className="w-16 text-center border border-gray-200 rounded-lg py-1 text-sm font-medium focus:ring-2 focus:ring-blue-300 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => increment(String(denom))}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold transition-colors"
                  aria-label={`Sumar billete de ${denom}`}
                >
                  +
                </button>
              </div>

              <span className="ml-auto text-sm font-semibold text-gray-600 w-28 text-right">
                {fmt(subtotal)}
              </span>
            </div>
          )
        })}

        <div className="flex items-center gap-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 w-28 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center text-xs font-bold">
              +
            </span>
            <div>
              <span className="block font-semibold text-sm text-gray-700">Resto</span>
              <span className="block text-[11px] text-gray-400">monedas y otros</span>
            </div>
          </div>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={bills.resto || ''}
            onChange={(e) => set('resto', parseFloat(e.target.value) || 0)}
            className="w-36 border border-gray-200 rounded-lg py-1 px-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
          />
          <span className="ml-auto text-sm font-semibold text-gray-600 w-28 text-right">
            {fmt(bills.resto ?? 0)}
          </span>
        </div>
      </div>

      {saldoSistema !== undefined && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 mb-1">Calculo</p>
          <p className="text-xs text-gray-600">{formula} = {fmt(total)}</p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t-2 border-gray-200 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 font-medium">{totalLabel}:</span>
          <span className="text-2xl font-bold text-gray-900">{fmt(total)}</span>
        </div>

        {saldoSistema !== undefined && (
          <>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Saldo del sistema:</span>
              <span className="font-semibold">{fmt(saldoSistema)}</span>
            </div>
            <div className={`flex justify-between items-center text-sm font-bold rounded-lg px-3 py-2
              ${diferencia === 0 ? 'bg-emerald-50 text-emerald-700'
                : (diferencia ?? 0) > 0 ? 'bg-amber-50 text-amber-700'
                : 'bg-red-50 text-red-700'}`}
            >
              <span>Diferencia:</span>
              <span>{fmt(diferencia ?? 0)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
