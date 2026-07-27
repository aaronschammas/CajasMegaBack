'use client'

// ─── Página: Reporte General (solo Admin General) ────────────────────────────
// Equivale a reporte_general.html — vista consolidada de todos los usuarios.

import { useState, useEffect, useCallback } from 'react'
import { getReporteGeneral, ReporteArco } from '@/lib/api/reportes'
import { ResumenFinanciero } from '@/components/reporte/ResumenFinanciero'
import { TablaMovimientos } from '@/components/reporte/TablaMovimientos'
import { useNotification } from '@/components/ui/Notification'
import { useRBAC } from '@/lib/hooks/useRBAC'
import { Movimiento } from '@/types/movimiento'
import Link from 'next/link'

export default function ReporteGeneralPage() {
  const { isAdmin } = useRBAC()
  const { show }    = useNotification()

  const [reportes, setReportes]       = useState<ReporteArco[]>([])
  const [loading, setLoading]         = useState(true)
  const [arcoSeleccionado, setArcoSel] = useState<number | 'todos'>('todos')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getReporteGeneral()
      setReportes(data)
    } catch (err: any) {
      show(err.message ?? 'No se pudo cargar el reporte general', 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => {
    if (!isAdmin()) {
      show('Acceso restringido a Administrador General', 'error')
      return
    }
    cargar()
  }, [cargar, isAdmin, show])

  // ── Movimientos consolidados del filtro actual ──────────────────────────
  const reporteFiltrado: ReporteArco[] = arcoSeleccionado === 'todos'
    ? reportes
    : reportes.filter((r) => r.arco.id === arcoSeleccionado)

  const movimientosConsolidados: Movimiento[] = reporteFiltrado.flatMap((r) => r.movements)

  const totalConsolidado = reporteFiltrado.reduce(
    (acc, r) => ({
      saldoInicial:  acc.saldoInicial  + r.arco.saldo_inicial,
      totalIngresos: acc.totalIngresos + r.arco.total_ingresos,
      totalEgresos:  acc.totalEgresos  + r.arco.total_egresos,
      saldoFinal:    acc.saldoFinal    + r.arco.saldo_final,
    }),
    { saldoInicial: 0, totalIngresos: 0, totalEgresos: 0, saldoFinal: 0 }
  )

  // ── Exportar Excel consolidado ────────────────────────────────────────────
  const exportarExcel = async () => {
    const XLSX = await import('xlsx')
    const wb   = XLSX.utils.book_new()

    // Hoja de resumen por cajero
    const resumen = reportes.map((r) => ({
      Cajero:         r.arco.usuario?.full_name ?? '—',
      Turno:          r.arco.turno === 'M' ? 'Mañana' : 'Tarde',
      'Saldo Inicial':  r.arco.saldo_inicial,
      'Total Ingresos': r.arco.total_ingresos,
      'Total Egresos':  r.arco.total_egresos,
      'Saldo Final':    r.arco.saldo_final,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen')

    // Hoja de movimientos detallados
    const detalle = movimientosConsolidados.map((m) => ({
      Tipo:     m.movement_type,
      Monto:    m.amount,
      Concepto: m.concept?.concept_name ?? '',
      Detalle:  m.details ?? '',
      Turno:    m.shift,
      Usuario:  m.creator?.full_name ?? '',
      Fecha:    new Date(m.movement_date).toLocaleString('es-AR'),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Movimientos')

    XLSX.writeFile(wb, `reporte_general_${new Date().toISOString().slice(0, 10)}.xlsx`)
    show('Excel generado', 'success')
  }

  if (!isAdmin()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-gray-400">
        <p className="text-5xl">🔒</p>
        <p className="font-medium">Acceso restringido a Administrador General</p>
        <Link href="/movimientos" className="text-blue-500 hover:underline text-sm">← Volver al dashboard</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-400">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        <p>Cargando reporte general…</p>
      </div>
    )
  }

  return (
    <div className="page-shell space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/movimientos" className="hover:text-blue-500 transition-colors">← Dashboard</Link>
            <span>/</span>
            <span>Reporte General</span>
          </div>
          <h1 className="page-heading">Reporte General del Día</h1>
          <p className="text-gray-500 text-sm mt-1">
            Vista consolidada de todos los cajeros —{' '}
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-xl text-sm font-bold">
          🛡️ Admin General
        </span>
      </div>

      {/* Filtro por cajero */}
      {reportes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setArcoSel('todos')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border
              ${arcoSeleccionado === 'todos'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            🌐 Todos ({reportes.length})
          </button>
          {reportes.map((r) => (
            <button
              key={r.arco.id}
              onClick={() => setArcoSel(r.arco.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border
                ${arcoSeleccionado === r.arco.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              👤 {r.arco.usuario?.full_name ?? `Arco #${r.arco.id}`}
            </button>
          ))}
        </div>
      )}

      {/* Resumen consolidado */}
      <ResumenFinanciero {...totalConsolidado} />

      {/* Tabla de movimientos por cajero */}
      {arcoSeleccionado === 'todos' && reportes.length > 1 ? (
        <div className="space-y-6">
          {reportes.map((r) => (
            <div key={r.arco.id}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">👤</div>
                <div>
                  <h3 className="font-bold text-gray-800">{r.arco.usuario?.full_name ?? `Arco #${r.arco.id}`}</h3>
                  <p className="text-xs text-gray-400">
                    Turno {r.arco.turno === 'M' ? 'Mañana' : 'Tarde'} ·{' '}
                    {r.movements.length} movimiento{r.movements.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <TablaMovimientos movimientos={r.movements} onExportExcel={exportarExcel} />
            </div>
          ))}
        </div>
      ) : (
        <div>
          <h2 className="mb-3 text-lg font-bold text-slate-800">Detalle de Movimientos</h2>
          <TablaMovimientos movimientos={movimientosConsolidados} onExportExcel={exportarExcel} />
        </div>
      )}
    </div>
  )
}
