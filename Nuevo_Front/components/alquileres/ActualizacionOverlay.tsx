'use client'

// ─── Overlay: Notificación de Actualización de Alquiler (INDEC) ──────────────
// Aparece automáticamente cuando hay propiedades con actualización pendiente.
// Equivale a actOverlay del alquileres.html original.

import { useState, useEffect } from 'react'
import { ActualizacionPendiente } from '@/types/alquiler'
import {
  getActualizacionesPendientes,
  confirmarActualizacion,
  posponerActualizacion,
} from '@/lib/api/alquileres'
import { fmt } from './helpers'
import { useNotification } from '@/components/ui/Notification'

interface Props {
  onActualizado?: () => void  // callback para recargar tabla
}

export function ActualizacionOverlay({ onActualizado }: Props) {
  const { show } = useNotification()
  const [pendientes, setPendientes] = useState<ActualizacionPendiente[]>([])
  const [indice, setIndice]         = useState(0)
  const [visible, setVisible]       = useState(false)

  const [montoInput, setMontoInput] = useState('')
  const [notasInput, setNotasInput] = useState('')
  const [showPosponer, setShowPosponer] = useState(false)
  const [fechaPosponer, setFechaPosponer] = useState('')
  const [guardando, setGuardando]   = useState(false)

  // Carga automática al montar (con delay para no bloquear la tabla)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const data = await getActualizacionesPendientes()
        if ((data.pendientes || []).length > 0) {
          setPendientes(data.pendientes)
          setIndice(0)
          setVisible(true)
        }
      } catch { /* silencioso */ }
    }, 1200)
    return () => clearTimeout(t)
  }, [])

  // Pre-completar el input cuando cambia el ítem actual
  useEffect(() => {
    if (!visible || pendientes.length === 0) return
    const item = pendientes[indice]
    setMontoInput(item.monto_recomendado.toFixed(2))
    setNotasInput('')
    setShowPosponer(false)
    setFechaPosponer('')
  }, [indice, pendientes, visible])

  if (!visible || pendientes.length === 0) return null

  const item  = pendientes[indice]
  const prop  = item.propiedad
  const infl  = item.inflacion || { fuente: '', meses: [], acumulado_pct: 0 }
  const total = pendientes.length
  const fmtFull = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n)

  // ── Navegar al siguiente ────────────────────────────────────────────────
  const siguiente = () => setIndice((i) => Math.min(i + 1, total - 1))

  // ── Cerrar overlay ──────────────────────────────────────────────────────
  const cerrar = () => {
    setVisible(false)
    setPendientes([])
  }

  const removerActual = () => {
    const nuevos = pendientes.filter((_, i) => i !== indice)
    if (nuevos.length === 0) { cerrar(); return }
    setPendientes(nuevos)
    setIndice(Math.min(indice, nuevos.length - 1))
  }

  // ── Confirmar actualización ─────────────────────────────────────────────
  const confirmar = async () => {
    const monto = parseFloat(montoInput)
    if (!monto || monto <= 0) { show('Ingresá un monto válido', 'warning'); return }
    setGuardando(true)
    try {
      await confirmarActualizacion(prop.id, monto, notasInput.trim() || undefined)
      show(`✅ Monto actualizado a ${fmtFull(monto)}`, 'success')
      onActualizado?.()
      removerActual()
    } catch (err: any) {
      show(err.message, 'error')
    } finally {
      setGuardando(false)
    }
  }

  // ── Posponer ────────────────────────────────────────────────────────────
  const togglePosponer = async () => {
    if (showPosponer && fechaPosponer) {
      // ejecutar
      try {
        await posponerActualizacion(prop.id, new Date(fechaPosponer).toISOString())
        show(`⏰ Actualización pospuesta hasta ${new Date(fechaPosponer).toLocaleDateString('es-AR')}`, 'info')
        removerActual()
      } catch (err: any) {
        show(err.message, 'error')
      }
      return
    }
    // Sugerir fecha por defecto: 15 días
    const d = new Date()
    d.setDate(d.getDate() + 15)
    setFechaPosponer(d.toISOString().split('T')[0])
    setShowPosponer((v) => !v)
  }

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-3xl px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🔔</div>
              <div>
                <p className="font-bold text-lg">Actualización Pendiente</p>
                <p className="text-amber-100 text-sm">Revisión de monto de alquiler</p>
              </div>
            </div>
            {total > 1 && (
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                {indice + 1} de {total}
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* ── Propiedad ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold text-gray-800">{prop.direccion}</h2>
            {prop.inquilino && (
              <p className="text-gray-500 text-sm mt-0.5">👤 Inquilino: {prop.inquilino}</p>
            )}
            {prop.frecuencia_actualizacion && (
              <p className="text-gray-400 text-xs mt-0.5">
                📅 Actualización cada {prop.frecuencia_actualizacion} mes{prop.frecuencia_actualizacion !== 1 ? 'es' : ''}
              </p>
            )}
          </div>

          {/* ── Tabla IPC ─────────────────────────────────────────────── */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
                📊 Inflación del período
              </p>
              <span className="text-xs text-gray-400">{infl.fuente || 'INDEC vía ArgentinaDatos'}</span>
            </div>

            {infl.meses.length === 0 ? (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <span>⚠️</span>
                <span>Sin datos de IPC disponibles. Podés ingresar el monto manualmente.</span>
              </div>
            ) : (
              <div>
                <table className="w-full text-sm mb-2">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-1.5 text-xs font-semibold text-gray-500">Mes</th>
                      <th className="text-right py-1.5 text-xs font-semibold text-gray-500">IPC (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {infl.meses.map((m, i) => (
                      <tr key={i}>
                        <td className="py-1.5 text-gray-700">{m.periodo}</td>
                        <td className="py-1.5 text-right font-medium text-blue-600">{m.pct.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300">
                      <td className="py-2 font-bold text-gray-800">Acumulado</td>
                      <td className="py-2 text-right font-bold text-2xl text-amber-600">
                        {infl.acumulado_pct?.toFixed(2) ?? '0.00'}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ── Comparativa de montos ─────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Monto actual</p>
              <p className="text-xl font-bold text-gray-700">{fmtFull(item.monto_actual)}</p>
            </div>
            <div className="text-gray-400 text-xl">→</div>
            <div className="flex-1 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-xs text-amber-600 mb-1">
                Recomendado
                {infl.acumulado_pct > 0 && (
                  <span className="ml-1 font-bold">+{infl.acumulado_pct.toFixed(2)}%</span>
                )}
              </p>
              <p className="text-xl font-bold text-amber-700">{fmtFull(item.monto_recomendado)}</p>
            </div>
          </div>

          {/* ── Input monto acordado ──────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🤝 Monto acordado
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
              <input
                type="number"
                value={montoInput}
                onChange={(e) => setMontoInput(e.target.value)}
                min={0}
                step={0.01}
                className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2.5 text-lg font-bold focus:ring-2 focus:ring-amber-300 focus:outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Precompletado con el valor recomendado. Podés modificarlo.
            </p>
          </div>

          {/* ── Notas ────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              💬 Notas (opcional)
            </label>
            <input
              type="text"
              value={notasInput}
              onChange={(e) => setNotasInput(e.target.value)}
              placeholder="Ej: acordado con inquilino el 05/03/2026"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
            />
          </div>

          {/* ── Sección posponer ─────────────────────────────────────── */}
          {showPosponer && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-blue-700 flex items-center gap-2">
                📅 Recordar a partir de:
              </p>
              <input
                type="date"
                value={fechaPosponer}
                onChange={(e) => setFechaPosponer(e.target.value)}
                className="w-full border border-blue-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none bg-white"
              />
              <p className="text-xs text-blue-500">
                El recordatorio volverá a aparecer en esa fecha.
              </p>
            </div>
          )}

          {/* ── Acciones ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={togglePosponer}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border
                ${showPosponer && fechaPosponer
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              ⏰ {showPosponer && fechaPosponer ? 'Confirmar fecha' : 'Posponer'}
            </button>

            <div className="flex gap-2">
              {total > 1 && indice < total - 1 && (
                <button onClick={siguiente}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors">
                  Siguiente →
                </button>
              )}
              <button
                onClick={confirmar}
                disabled={guardando}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
              >
                {guardando
                  ? <><span className="animate-spin">⏳</span> Guardando…</>
                  : '✅ Actualizar monto'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
