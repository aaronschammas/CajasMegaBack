'use client'

import { MovimientoPendiente } from '@/types/movimiento'
import { AppIcon } from '@/components/ui/AppIcon'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

interface Props {
  pila: MovimientoPendiente[]
  onEliminar: (index: number) => void
  onEnviar: () => void
  enviando?: boolean
  tipo: 'Ingreso' | 'Egreso'
}

export function PilaMovimientos({ pila, onEliminar, onEnviar, enviando = false, tipo }: Props) {
  const isIngreso = tipo === 'Ingreso'
  const palette = isIngreso
    ? { soft: 'bg-emerald-50 text-emerald-700', amount: 'text-emerald-700', button: 'bg-emerald-700 hover:bg-emerald-800' }
    : { soft: 'bg-red-50 text-red-700', amount: 'text-red-700', button: 'bg-red-700 hover:bg-red-800' }

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-xl ${palette.soft}`}>
            <AppIcon name="send" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">Pila de movimientos</h2>
            <p className="text-xs text-slate-500">Revisá antes de confirmar.</p>
          </div>
        </div>
        <span className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-sm font-bold ${palette.soft}`}>{pila.length}</span>
      </div>

      <div className="min-h-[120px] p-3">
        {pila.length === 0 ? (
          <div className="flex flex-col items-center py-7 text-center text-slate-400">
            <AppIcon name="send" className="mb-2 h-8 w-8" />
            <p className="text-sm">No hay movimientos pendientes.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pila.map((movement, index) => (
              <div key={`${movement.fecha}-${movement.amount}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-bold ${palette.amount}`}>{fmt(movement.amount)}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">Turno {movement.shift}</span>
                    <span className="text-xs text-slate-400">{movement.fecha}</span>
                  </div>
                  {movement.details && <p className="mt-1 truncate text-xs text-slate-500">{movement.details}</p>}
                </div>
                <button type="button" onClick={() => onEliminar(index)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700" title="Quitar de la pila" aria-label="Quitar de la pila">
                  <AppIcon name="trash" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <button type="button" onClick={onEnviar} disabled={pila.length === 0 || enviando} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 ${palette.button}`}>
          <AppIcon name="send" className="h-5 w-5" />
          {enviando ? 'Enviando…' : `Enviar a la base de datos (${pila.length})`}
        </button>
      </div>
    </section>
  )
}
