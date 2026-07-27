'use client'

// ─── Tarjetas de resumen financiero ──────────────────────────────────────────

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
  const cards = [
    { label: 'Saldo Inicial',    value: saldoInicial,   icon: '🏦', color: 'border-indigo-200 bg-indigo-50',  text: 'text-indigo-700' },
    { label: 'Total Ingresos',   value: totalIngresos,  icon: '📈', color: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700' },
    { label: 'Total Egresos',    value: totalEgresos,   icon: '📉', color: 'border-red-200 bg-red-50',         text: 'text-red-600' },
    { label: 'Retiro',           value: retiro,         icon: '💸', color: 'border-amber-200 bg-amber-50',     text: 'text-amber-700' },
    { label: 'Saldo Final',      value: saldoFinal,     icon: '💰', color: 'border-blue-200 bg-blue-50',       text: 'text-blue-700', wide: true },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.filter(c => c.value !== undefined).map((card) => (
        <div key={card.label} className={`rounded-2xl border-2 ${card.color} p-4 ${card.wide ? 'col-span-2 md:col-span-4' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{card.icon}</span>
            <p className="text-xs font-medium text-gray-500">{card.label}</p>
          </div>
          <p className={`text-2xl font-bold ${card.text}`}>{fmt(card.value)}</p>
        </div>
      ))}
    </div>
  )
}
