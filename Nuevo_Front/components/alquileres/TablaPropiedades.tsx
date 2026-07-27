'use client'

// ─── Tabla principal de propiedades con 12 columnas de meses ─────────────────
// Equivale al <table id="tabla"> del original.

import { useMemo } from 'react'
import { Propiedad, FiltroEstado, EstadoPago } from '@/types/alquiler'
import {
  MESES_CORTO, ESTADO_ICONO, ESTADO_CLASSES, fmt, fmtCorto, matchFiltro,
} from './helpers'

interface Props {
  propiedades:   Propiedad[]
  loading:       boolean
  anio:          number
  filtroEstado:  FiltroEstado
  busqueda:      string
  onClickMes:    (propId: string, mes: number) => void
  onVerDetalle:  (propId: string) => void
  esAdmin:       boolean
}

export function TablaPropiedades({
  propiedades, loading, filtroEstado, busqueda,
  onClickMes, onVerDetalle, esAdmin,
}: Props) {

  // ── Filtrar ───────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return propiedades.filter((p) => {
      const matchBusq = !q ||
        p.direccion.toLowerCase().includes(q) ||
        (p.inquilino || '').toLowerCase().includes(q)
      return matchBusq && matchFiltro(p, filtroEstado)
    })
  }, [propiedades, busqueda, filtroEstado])

  // ── Totales del footer ────────────────────────────────────────────────────
  const deudaMes = useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      propiedades
        .filter((p) => p.ocupada)
        .reduce((acc, p) => {
          const pago = (p.pagos || [])[i]
          return acc + (pago && pago.estado !== 'paid' ? p.alquiler_mensual : 0)
        }, 0)
    ), [propiedades])

  const deudaTotal = deudaMes.reduce((a, b) => a + b, 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        <p>Cargando propiedades…</p>
      </div>
    )
  }

  if (filtradas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
        <p className="text-5xl">🏢</p>
        <p className="font-medium">No se encontraron propiedades</p>
      </div>
    )
  }

  return (
    <div className="surface-card max-w-full min-w-0 overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[160px] sticky left-0 bg-gray-50 z-10">
              Propiedad
            </th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[120px]">
              Inquilino
            </th>
            {MESES_CORTO.map((m) => (
              <th key={m} className="text-center px-1 py-3 text-xs font-semibold text-gray-500 uppercase w-10">
                {m}
              </th>
            ))}
            <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[80px]">
              Deuda
            </th>
            <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase w-10">
              Ver
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-50">
          {filtradas.map((prop) => {
            const pagos      = prop.pagos || Array(12).fill({ estado: 'pending', monto: 0 })
            const esDolar    = prop.paga_en_dolares
            const deuda      = pagos.filter((p) => p.estado !== 'paid').length * prop.alquiler_mensual
            const fechaAct   = prop.fecha_actualizacion ? new Date(prop.fecha_actualizacion) : null
            const mesAct     = fechaAct ? fechaAct.getMonth() : -1

            return (
              <tr
                key={prop.id}
                onClick={() => onVerDetalle(prop.id)}
                className={`cursor-pointer transition-colors hover:bg-blue-50/40
                  ${!prop.ocupada ? 'opacity-60' : ''}`}
              >
                {/* Dirección */}
                <td className="px-4 py-3 sticky left-0 bg-white z-10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 text-sm">{prop.direccion}</span>
                    {esDolar && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">
                        USD
                      </span>
                    )}
                    {!prop.ocupada && (
                      <span className="text-xs text-gray-400 italic">desocupada</span>
                    )}
                  </div>
                </td>

                {/* Inquilino */}
                <td className="px-3 py-3 text-gray-500 text-sm">
                  {prop.ocupada ? (prop.inquilino || '—') : '—'}
                </td>

                {/* Celdas de meses */}
                {pagos.map((pago, i) => {
                  if (!prop.ocupada) {
                    return (
                      <td key={i} className="text-center px-1 py-2">
                        <span className="text-gray-200 text-xs">—</span>
                      </td>
                    )
                  }
                  const estado       = pago.estado as EstadoPago
                  const esActMes     = !esDolar && mesAct === i
                  const estadoClass  = ESTADO_CLASSES[estado]

                  return (
                    <td key={i} className="text-center px-1 py-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onClickMes(prop.id, i) }}
                        title={`${MESES_CORTO[i]} — ${esDolar ? `USD ${prop.monto_dolares}` : estado}`}
                        className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all hover:scale-110 hover:shadow-sm
                          ${estadoClass}
                          ${esActMes ? 'ring-2 ring-cyan-400 ring-offset-1' : ''}
                          ${esDolar && estado !== 'paid' ? 'border-amber-300 bg-amber-50 text-amber-700' : ''}`}
                      >
                        {ESTADO_ICONO[estado]}
                      </button>
                    </td>
                  )
                })}

                {/* Deuda */}
                <td className={`px-3 py-3 text-right font-bold text-sm ${deuda > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {deuda > 0 ? fmtCorto(deuda) : '$0'}
                </td>

                {/* Acción ver */}
                <td className="px-2 py-3 text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onVerDetalle(prop.id) }}
                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                    title="Ver detalle"
                  >
                    👁️
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>

        {/* Footer con deuda por mes */}
        <tfoot className="border-t-2 border-gray-300 bg-purple-50">
          <tr>
            <td colSpan={2} className="px-4 py-3 text-left font-bold text-purple-700 text-sm sticky left-0 bg-purple-50">
              Deuda por Mes
            </td>
            {deudaMes.map((d, i) => (
              <td key={i} className={`text-center px-1 py-3 text-xs font-bold ${d > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {d > 0 ? fmtCorto(d) : '—'}
              </td>
            ))}
            <td className={`px-3 py-3 text-right font-bold text-sm ${deudaTotal > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {deudaTotal > 0 ? fmt(deudaTotal) : '—'}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
