'use client'

// ─── Tabla de movimientos con búsqueda, filtro y exportación ─────────────────

import { useState, useMemo } from 'react'
import { Movimiento } from '@/types/movimiento'
import { AppIcon } from '@/components/ui/AppIcon'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

interface Props {
  movimientos: Movimiento[]
  onExportPDF?: () => void
  onExportExcel?: () => void
}

type FiltroTipo = 'Todos' | 'Ingreso' | 'Egreso'

export function TablaMovimientos({ movimientos, onExportPDF, onExportExcel }: Props) {
  const [busqueda, setBusqueda]     = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('Todos')

  const filtrados = useMemo(() => {
    return movimientos.filter((m) => {
      const matchTipo = filtroTipo === 'Todos' || m.movement_type === filtroTipo
      const texto = busqueda.toLowerCase()
      const matchBusqueda =
        !texto ||
        m.concept?.concept_name?.toLowerCase().includes(texto) ||
        m.details?.toLowerCase().includes(texto) ||
        m.creator?.full_name?.toLowerCase().includes(texto) ||
        String(m.amount).includes(texto)
      return matchTipo && matchBusqueda
    })
  }, [movimientos, busqueda, filtroTipo])

  const totalFiltrado = filtrados.reduce(
    (acc, m) => ({
      ingresos: acc.ingresos + (m.movement_type === 'Ingreso' ? m.amount : 0),
      egresos:  acc.egresos  + (m.movement_type === 'Egreso'  ? m.amount : 0),
    }),
    { ingresos: 0, egresos: 0 }
  )

  return (
    <div className="surface-card min-w-0 overflow-hidden">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <AppIcon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar concepto, detalle, usuario…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none"
          />
        </div>

        {/* Filtro tipo */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
          {(['Todos', 'Ingreso', 'Egreso'] as FiltroTipo[]).map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`px-3 py-2 font-medium transition-colors
                ${filtroTipo === t
                  ? t === 'Ingreso' ? 'bg-emerald-500 text-white'
                    : t === 'Egreso' ? 'bg-red-500 text-white'
                    : 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Botones exportar */}
        <div className="flex gap-2 ml-auto">
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors border border-emerald-200"
            >
              <AppIcon name="chart" className="h-4 w-4" /> Excel
            </button>
          )}
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors border border-red-200"
            >
              <AppIcon name="report" className="h-4 w-4" /> PDF
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Concepto</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Detalle</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Usuario</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Turno</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">📭</p>
                  <p>{busqueda || filtroTipo !== 'Todos' ? 'Sin resultados para esta búsqueda' : 'No hay movimientos'}</p>
                </td>
              </tr>
            ) : (
              filtrados.map((m) => {
                const isIngreso = m.movement_type === 'Ingreso'
                return (
                  <tr key={m.movement_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                        ${isIngreso ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {isIngreso ? '⬆️' : '⬇️'} {m.movement_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {m.concept?.concept_name ?? `#${m.concept_id}`}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-[200px] truncate">
                      {m.details || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {m.creator?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {m.shift === 'M' ? '☀️ Mañana' : '🌙 Tarde'}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${isIngreso ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isIngreso ? '+' : '−'}{fmt(m.amount)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {/* Footer totales */}
          {filtrados.length > 0 && (
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-xs text-gray-400">
                  {filtrados.length} movimiento{filtrados.length !== 1 ? 's' : ''}
                </td>
                <td className="px-4 py-3 text-right text-xs hidden lg:table-cell">
                  <span className="text-emerald-600 font-semibold">+{fmt(totalFiltrado.ingresos)}</span>
                  <span className="text-gray-300 mx-1">|</span>
                  <span className="text-red-500 font-semibold">−{fmt(totalFiltrado.egresos)}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-800">
                  {fmt(totalFiltrado.ingresos - totalFiltrado.egresos)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
