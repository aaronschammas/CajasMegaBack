'use client'

// ─── Página: Reporte diario del arco ─────────────────────────────────────────
// Equivale a reporte.html + reporte.js (vista personal del usuario logueado).

import { useState, useEffect, useCallback } from 'react'
import { getReporte, ReporteArco } from '@/lib/api/reportes'
import { ResumenFinanciero } from '@/components/reporte/ResumenFinanciero'
import { TablaMovimientos } from '@/components/reporte/TablaMovimientos'
import { useNotification } from '@/components/ui/Notification'
import Link from 'next/link'

export default function ReportePage() {
  const [data, setData]       = useState<ReporteArco | null>(null)
  const [loading, setLoading] = useState(true)
  const { show } = useNotification()

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const reporte = await getReporte()
      setData(reporte)
    } catch (err: any) {
      show(err.message ?? 'No se pudo cargar el reporte', 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => { cargar() }, [cargar])

  // ── Exportar PDF ─────────────────────────────────────────────────────────
  const exportarPDF = async () => {
    if (!data) return
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const { arco, movements } = data
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

    doc.setFontSize(16)
    doc.text('Reporte de Caja — MegaAdmin', 14, 20)
    doc.setFontSize(10)
    doc.text(`Usuario: ${arco.usuario?.full_name ?? '—'}`, 14, 30)
    doc.text(`Turno: ${arco.turno === 'M' ? 'Mañana' : 'Tarde'}`, 14, 36)
    doc.text(`Fecha: ${new Date(arco.fecha_apertura).toLocaleDateString('es-AR')}`, 14, 42)

    doc.setFontSize(11)
    doc.text('Resumen', 14, 52)
    doc.setFontSize(9)
    doc.text(`Saldo Inicial:   ${fmt(arco.saldo_inicial)}`, 14, 60)
    doc.text(`Total Ingresos:  ${fmt(arco.total_ingresos)}`, 14, 66)
    doc.text(`Total Egresos:   ${fmt(arco.total_egresos)}`, 14, 72)
    doc.text(`Saldo Final:     ${fmt(arco.saldo_final)}`, 14, 78)

    let y = 90
    doc.setFontSize(11)
    doc.text('Movimientos', 14, y); y += 8
    doc.setFontSize(8)
    movements.forEach((m) => {
      if (y > 270) { doc.addPage(); y = 20 }
      const signo = m.movement_type === 'Ingreso' ? '+' : '-'
      doc.text(
        `${signo} ${fmt(m.amount)}  |  ${m.concept?.concept_name ?? ''}  |  ${m.details ?? ''}`,
        14, y
      )
      y += 6
    })

    doc.save(`reporte_${new Date().toISOString().slice(0, 10)}.pdf`)
    show('PDF generado', 'success')
  }

  // ── Exportar Excel ────────────────────────────────────────────────────────
  const exportarExcel = async () => {
    if (!data) return
    const XLSX = await import('xlsx')
    const rows = data.movements.map((m) => ({
      Tipo:    m.movement_type,
      Monto:   m.amount,
      Concepto: m.concept?.concept_name ?? '',
      Detalle: m.details ?? '',
      Turno:   m.shift,
      Usuario: m.creator?.full_name ?? '',
      Fecha:   new Date(m.movement_date).toLocaleString('es-AR'),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
    XLSX.writeFile(wb, `reporte_${new Date().toISOString().slice(0, 10)}.xlsx`)
    show('Excel generado', 'success')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-400">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        <p>Cargando reporte…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-gray-400">
        <p className="text-5xl">📭</p>
        <p className="font-medium">No hay reporte disponible para el día de hoy</p>
        <Link href="/movimientos" className="text-blue-500 hover:underline text-sm">← Volver al dashboard</Link>
      </div>
    )
  }

  const { arco, movements } = data

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/movimientos" className="hover:text-blue-500 transition-colors">← Dashboard</Link>
            <span>/</span>
            <span>Reporte Diario</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">📊 Resumen del Día</h1>
          <p className="text-gray-500 text-sm mt-1">
            {arco.usuario?.full_name ?? '—'}
            {' · '}
            Turno {arco.turno === 'M' ? 'Mañana' : 'Tarde'}
            {' · '}
            {new Date(arco.fecha_apertura).toLocaleDateString('es-AR', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium shadow-sm transition-colors"
        >
          🖨️ Imprimir
        </button>
      </div>

      {/* Tarjetas de resumen */}
      <ResumenFinanciero
        saldoInicial={arco.saldo_inicial}
        totalIngresos={arco.total_ingresos}
        totalEgresos={arco.total_egresos}
        saldoFinal={arco.saldo_final}
      />

      {/* Tabla de movimientos */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">📋 Detalle de Movimientos</h2>
        <TablaMovimientos
          movimientos={movements}
          onExportPDF={exportarPDF}
          onExportExcel={exportarExcel}
        />
      </div>
    </div>
  )
}
