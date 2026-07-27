'use client'

// ─── Página: Historial de movimientos ────────────────────────────────────────
// Equivale a historial_movimientos.html
// Lista de arcos cerrados con sus movimientos, colapsables y paginados.

import { useState, useEffect, useCallback } from 'react'
import { getHistorial, getMovimientosArcoHistorial, HistorialArco } from '@/lib/api/reportes'
import { TablaMovimientos } from '@/components/reporte/TablaMovimientos'
import { ResumenFinanciero } from '@/components/reporte/ResumenFinanciero'
import { useRBAC } from '@/lib/hooks/useRBAC'
import { useNotification } from '@/components/ui/Notification'
import { Movimiento } from '@/types/movimiento'
import Link from 'next/link'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

const LIMIT = 10

export default function HistorialPage() {
  const { isAdmin } = useRBAC()
  const { show }    = useNotification()
  const admin       = isAdmin()

  const [arcos, setArcos]           = useState<HistorialArco[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [vistaGlobal, setVistaGlobal] = useState(false)

  // Movimientos expandidos: map arcoId → Movimiento[]
  const [expandidos, setExpandidos] = useState<Record<number, Movimiento[] | 'loading'>>({})

  const cargar = useCallback(async (p: number, global: boolean) => {
    setLoading(true)
    try {
      const data = await getHistorial({ page: p, limit: LIMIT, isGlobal: global })
      setArcos(data.arcos)
      setTotal(data.total)
    } catch (err: any) {
      show(err.message ?? 'No se pudo cargar el historial', 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => { cargar(page, vistaGlobal) }, [cargar, page, vistaGlobal])

  // Expandir / colapsar un arco y cargar sus movimientos si no están
  const toggleArco = async (arcoId: number) => {
    if (expandidos[arcoId]) {
      // Colapsar
      setExpandidos((prev) => { const n = { ...prev }; delete n[arcoId]; return n })
      return
    }
    setExpandidos((prev) => ({ ...prev, [arcoId]: 'loading' }))
    try {
      const movs = await getMovimientosArcoHistorial(arcoId)
      setExpandidos((prev) => ({ ...prev, [arcoId]: movs }))
    } catch {
      setExpandidos((prev) => { const n = { ...prev }; delete n[arcoId]; return n })
      show('Error al cargar movimientos', 'error')
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="page-shell space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/movimientos" className="hover:text-blue-500 transition-colors">← Dashboard</Link>
            <span>/</span>
            <span>Historial</span>
          </div>
          <h1 className="page-heading">Historial de Arqueos</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} arco{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Toggle global (solo admin) */}
        {admin && (
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-2 shadow-sm">
            <span className="text-sm text-gray-600 font-medium">Vista:</span>
            <button
              onClick={() => { setVistaGlobal(false); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${!vistaGlobal ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              🏠 Personal
            </button>
            <button
              onClick={() => { setVistaGlobal(true); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${vistaGlobal ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              🌐 Global
            </button>
          </div>
        )}
      </div>

      {/* Lista de arcos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          <p>Cargando historial…</p>
        </div>
      ) : arcos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <p className="text-5xl">📭</p>
          <p className="font-medium">No hay arcos registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {arcos.map((item) => {
            const { arco } = item
            const estaExpandido = !!expandidos[arco.id]
            const movsData      = expandidos[arco.id]
            const isLoadingMovs = movsData === 'loading'
            const movimientos   = Array.isArray(movsData) ? movsData : []

            return (
              <div key={arco.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Cabecera del arco (clickeable) */}
                <button
                  onClick={() => toggleArco(arco.id)}
                  className="w-full flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Ícono estado */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                    ${arco.saldo_final !== undefined ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <span className="text-lg">{arco.saldo_final !== undefined ? '✅' : '🔄'}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-800">Arco #{arco.id}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {arco.turno === 'M' ? '☀️ Mañana' : '🌙 Tarde'}
                      </span>
                      {arco.is_global && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                          🌐 Global
                        </span>
                      )}
                      {arco.usuario && (
                        <span className="text-xs text-gray-400">👤 {arco.usuario.full_name}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(arco.fecha_apertura).toLocaleString('es-AR')}
                      {arco.fecha_cierre && ` → ${new Date(arco.fecha_cierre).toLocaleString('es-AR')}`}
                    </p>
                  </div>

                  {/* Montos clave */}
                  <div className="flex gap-4 shrink-0 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Ingresos</p>
                      <p className="font-semibold text-emerald-600">{fmt(arco.total_ingresos ?? 0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Egresos</p>
                      <p className="font-semibold text-red-500">{fmt(arco.total_egresos ?? 0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Saldo final</p>
                      <p className="font-bold text-gray-800">{fmt(arco.saldo_final ?? 0)}</p>
                    </div>
                  </div>

                  {/* Chevron */}
                  <span className={`text-gray-400 transition-transform duration-200 shrink-0 ${estaExpandido ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {/* Panel expandido */}
                {estaExpandido && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                    <ResumenFinanciero
                      saldoInicial={arco.saldo_inicial}
                      totalIngresos={arco.total_ingresos ?? 0}
                      totalEgresos={arco.total_egresos ?? 0}
                      saldoFinal={arco.saldo_final ?? 0}
                    />

                    {isLoadingMovs ? (
                      <div className="flex justify-center py-6">
                        <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <TablaMovimientos movimientos={movimientos} />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-500 px-3">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
