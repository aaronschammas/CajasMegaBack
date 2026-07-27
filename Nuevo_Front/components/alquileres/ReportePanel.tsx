'use client'

// ─── Panel de reporte de ingresos (solo Admin General) ───────────────────────

import { useState, useEffect, useCallback } from 'react'
import { getResumenMovimientos } from '@/lib/api/alquileres'
import { fmt } from './helpers'

type Periodo = 'dia' | 'mes' | 'anio'

export function ReportePanel() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [data, setData]       = useState({ total_monto: 0, cantidad: 0 })
  const [loading, setLoading] = useState(false)

  const cargar = useCallback(async (p: Periodo) => {
    setLoading(true)
    try {
      const res = await getResumenMovimientos(p)
      setData(res)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar(periodo) }, [cargar, periodo])

  const promedio = data.cantidad > 0 ? data.total_monto / data.cantidad : 0

  const tabs: { key: Periodo; label: string }[] = [
    { key: 'dia',  label: 'Hoy'       },
    { key: 'mes',  label: 'Este Mes'  },
    { key: 'anio', label: 'Este Año'  },
  ]

  return (
    <section className="surface-card min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <span>📊</span> Resumen de Ingresos por Alquileres
        </h2>
        <div className="flex max-w-full overflow-x-auto rounded-xl border border-gray-200 text-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setPeriodo(t.key); cargar(t.key) }}
              className={`px-4 py-2 font-medium transition-colors
                ${periodo === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Recaudado',   value: loading ? '…' : fmt(data.total_monto), color: 'text-emerald-600' },
          { label: 'Pagos Registrados', value: loading ? '…' : String(data.cantidad), color: 'text-blue-600' },
          { label: 'Promedio por Pago', value: loading ? '…' : fmt(promedio),          color: 'text-indigo-600' },
        ].map((item) => (
          <div key={item.label} className="text-center bg-gray-50 rounded-xl p-4">
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-gray-500 mt-1">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
