'use client'

// ─── Pila de movimientos pendientes ──────────────────────────────────────────
// Equivale a la sección "Por enviar a la DB" de ingresos.html / egresos.html.

import { MovimientoPendiente } from '@/types/movimiento'

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

  return (
    <div className={`rounded-2xl border-2 ${isIngreso ? 'border-emerald-200' : 'border-red-200'} bg-white shadow-sm`}>
      {/* Header de la pila */}
      <div className={`px-5 py-4 rounded-t-2xl flex items-center justify-between
        ${isIngreso ? 'bg-emerald-50' : 'bg-red-50'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">⏳</span>
          <div>
            <h3 className="font-bold text-gray-800">Por enviar a la DB</h3>
            <p className="text-xs text-gray-500">Movimientos pendientes de confirmación</p>
          </div>
        </div>
        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white
          ${isIngreso ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {pila.length}
        </span>
      </div>

      {/* Lista */}
      <div className="p-3 min-h-[80px]">
        {pila.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-gray-400">
            <span className="text-3xl mb-1">📭</span>
            <p className="text-sm">No hay movimientos pendientes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pila.map((mov, index) => (
              <div
                key={index}
                className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-bold ${isIngreso ? 'text-emerald-600' : 'text-red-500'}`}>
                      {fmt(mov.amount)}
                    </span>
                    <span className="text-xs text-gray-500">Turno {mov.shift}</span>
                    <span className="text-xs text-gray-500">{mov.fecha}</span>
                  </div>
                  {mov.details && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{mov.details}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onEliminar(index)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-xl font-bold shrink-0"
                  title="Quitar de la pila"
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botón enviar */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onEnviar}
          disabled={pila.length === 0 || enviando}
          className={`w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2
            ${pila.length === 0 || enviando
              ? 'bg-gray-300 cursor-not-allowed'
              : isIngreso
                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-sm hover:shadow-md'
                : 'bg-red-500 hover:bg-red-600 shadow-sm hover:shadow-md'}`}
        >
          {enviando
            ? <><span className="animate-spin">⏳</span> Enviando…</>
            : <><span>📤</span> Enviar a la DB ({pila.length})</>}
        </button>
      </div>
    </div>
  )
}
