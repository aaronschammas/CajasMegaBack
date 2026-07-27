'use client'

// ─── Formulario compartido Ingresos / Egresos ─────────────────────────────────
// Reemplaza ingresos.html + egresos.html + sus JS.
// Parámetro `tipo` determina si es Ingreso o Egreso.

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/lib/store/appStore'
import { useArco } from '@/lib/hooks/useArco'
import { usePila } from '@/lib/hooks/usePila'
import { getConceptosPorTipo } from '@/lib/api/conceptos'
import { getMovimientosArco, enviarPila, deleteMovimiento } from '@/lib/api/movimientos'
import { PilaMovimientos } from '@/components/pila/PilaMovimientos'
import { useNotification } from '@/components/ui/Notification'
import { Concepto } from '@/types/concepto'
import { Movimiento, MovimientoPendiente } from '@/types/movimiento'

interface Props {
  tipo: 'Ingreso' | 'Egreso'
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

export function MovimientoForm({ tipo }: Props) {
  const router = useRouter()
  const isIngreso = tipo === 'Ingreso'
  const { user } = useAppStore()
  const { arco, arcoAbierto } = useArco()
  const { pila, agregar, eliminar, vaciar } = usePila()
  const { show } = useNotification()

  // Estado del formulario
  const [amount, setAmount]       = useState('')
  const [shift, setShift]         = useState<'M' | 'T'>('M')
  const [conceptId, setConceptId] = useState<number | ''>('')
  const [details, setDetails]     = useState('')

  // Datos cargados desde la API
  const [conceptos, setConceptos]       = useState<Concepto[]>([])
  const [movimientosDB, setMovimientosDB] = useState<Movimiento[]>([])
  const [loadingDB, setLoadingDB]       = useState(false)
  const [enviando, setEnviando]         = useState(false)

  // Cargar conceptos filtrados por tipo
  useEffect(() => {
    getConceptosPorTipo(tipo)
      .then(setConceptos)
      .catch(() => show('No se pudieron cargar los conceptos', 'error'))
  }, [tipo, show])

  // Cargar movimientos del arco actual de la DB
  const cargarMovimientosDB = useCallback(async () => {
    if (!arco?.id) return
    setLoadingDB(true)
    try {
      const data = await getMovimientosArco(arco.id)
      // Filtrar solo el tipo de la página actual
      setMovimientosDB(data.movements.filter((m) => m.movement_type === tipo))
    } catch {
      show('No se pudieron cargar los movimientos', 'error')
    } finally {
      setLoadingDB(false)
    }
  }, [arco?.id, tipo, show])

  useEffect(() => { cargarMovimientosDB() }, [cargarMovimientosDB])

  // ── Agregar a la pila ────────────────────────────────────────────────────
  const handleAgregar = () => {
    if (!arcoAbierto || !arco?.id) {
      show('Debés abrir un arqueo para registrar movimientos', 'warning')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      show('Ingresá un monto válido', 'warning'); return
    }
    if (!conceptId) {
      show('Seleccioná un concepto', 'warning'); return
    }
    if (!user?.user_id) {
      show('Usuario no identificado', 'error'); return
    }

    const mov: MovimientoPendiente = {
      movement_type: tipo,
      amount: parsedAmount,
      shift,
      concept_id: Number(conceptId),
      details: details.trim() || undefined,
      created_by: user.user_id,
      arco_id: arco.id,
      fecha: new Date().toLocaleDateString('es-AR'),
    }
    agregar(mov)
    setAmount('')
    setDetails('')
    show(`${isIngreso ? '📥' : '📤'} Movimiento agregado a la pila`, 'success')
  }

  // ── Enviar pila a la DB ──────────────────────────────────────────────────
  const handleEnviar = async () => {
    if (!arcoAbierto || !arco?.id) {
      show('No hay arqueo abierto', 'error'); return
    }
    if (pila.length === 0) {
      show('La pila está vacía', 'warning'); return
    }
    setEnviando(true)
    try {
      await enviarPila(tipo, pila)
      vaciar()
      await cargarMovimientosDB()
      show(`✅ ${pila.length} movimiento(s) guardados`, 'success')
      setTimeout(() => router.push('/movimientos'), 800)
    } catch (err: any) {
      show(err.message ?? 'Error al enviar movimientos', 'error')
    } finally {
      setEnviando(false)
    }
  }

  // ── Eliminar movimiento de la DB ─────────────────────────────────────────
  const handleDeleteDB = async (id: number) => {
    if (!confirm('¿Eliminar este movimiento?')) return
    try {
      await deleteMovimiento(id)
      setMovimientosDB((prev) => prev.filter((m) => m.movement_id !== id))
      show('Movimiento eliminado', 'success')
    } catch (err: any) {
      show(err.message, 'error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-40 border-b shadow-sm ${isIngreso ? 'bg-emerald-600' : 'bg-red-500'}`}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <span className="text-2xl">{isIngreso ? '➕' : '➖'}</span>
            <h1 className="font-bold text-lg">Gestión de {tipo}s</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={isIngreso ? '/egresos' : '/ingresos'}
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors"
            >
              {isIngreso ? '➖ Egresos' : '➕ Ingresos'}
            </Link>
            <Link
              href="/movimientos"
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors"
            >
              🏠 Salir
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-2 gap-6">

        {/* ── Formulario ──────────────────────────────────────────────────── */}
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Registrar Nuevo {tipo}</h2>
            <p className="text-sm text-gray-500">Completá los campos para agregar un movimiento</p>
          </div>

          {/* Estado del arco */}
          {!arcoAbierto && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-medium">
              <span>⚠️</span>
              <span>No hay arqueo abierto. Volvé al dashboard para abrirlo.</span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            {/* Tipo (solo display) */}
            <div className="flex items-center gap-3">
              <label className="w-32 text-sm font-medium text-gray-600 shrink-0">🏷️ Tipo:</label>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold
                ${isIngreso ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                {tipo}s
              </span>
            </div>

            {/* Monto */}
            <div className="flex items-center gap-3">
              <label className="w-32 text-sm font-medium text-gray-600 shrink-0">💲 Monto:</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0"
                placeholder="0.00"
                disabled={!arcoAbierto}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Turno */}
            <div className="flex items-center gap-3">
              <label className="w-32 text-sm font-medium text-gray-600 shrink-0">🕐 Turno:</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as 'M' | 'T')}
                disabled={!arcoAbierto}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none disabled:bg-gray-50"
              >
                <option value="M">Mañana (M)</option>
                <option value="T">Tarde (T)</option>
              </select>
            </div>

            {/* Concepto */}
            <div className="flex items-center gap-3">
              <label className="w-32 text-sm font-medium text-gray-600 shrink-0">📋 Concepto:</label>
              <select
                value={conceptId}
                onChange={(e) => setConceptId(Number(e.target.value))}
                disabled={!arcoAbierto || conceptos.length === 0}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none disabled:bg-gray-50"
              >
                <option value="">— Seleccioná un concepto —</option>
                {conceptos.map((c) => (
                  <option key={c.id} value={c.id}>{c.concept_name}</option>
                ))}
              </select>
            </div>

            {/* Realizado por */}
            <div className="flex items-center gap-3">
              <label className="w-32 text-sm font-medium text-gray-600 shrink-0">👤 Por:</label>
              <input
                type="text"
                value={user?.full_name ?? ''}
                readOnly
                className="flex-1 border border-gray-100 bg-gray-50 rounded-xl px-4 py-2 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* Detalle */}
            <div className="flex gap-3">
              <label className="w-32 text-sm font-medium text-gray-600 shrink-0 pt-2">💬 Detalle:</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                disabled={!arcoAbierto}
                placeholder="Detalles adicionales (opcional)…"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-300 focus:outline-none disabled:bg-gray-50"
              />
            </div>

            {/* Botón agregar */}
            <button
              type="button"
              onClick={handleAgregar}
              disabled={!arcoAbierto}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2
                ${!arcoAbierto
                  ? 'bg-gray-300 cursor-not-allowed'
                  : isIngreso
                    ? 'bg-emerald-500 hover:bg-emerald-600 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                    : 'bg-red-500 hover:bg-red-600 shadow-sm hover:shadow-md hover:-translate-y-0.5'}`}
            >
              <span>➕</span> Agregar a la pila
            </button>
          </div>

          {/* Info inferior */}
          <div className="flex gap-4">
            <div className="flex-1 bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <p className="text-xs text-gray-400">Fecha actual</p>
                <p className="text-sm font-semibold text-gray-700">
                  {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex-1 bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">👤</span>
              <div>
                <p className="text-xs text-gray-400">Usuario</p>
                <p className="text-sm font-semibold text-gray-700 truncate">{user?.full_name ?? '—'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pila + Movimientos en DB ─────────────────────────────────── */}
        <aside className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Pila de Movimientos</h2>
            <p className="text-sm text-gray-500">Revisá y enviá antes de confirmar</p>
          </div>

          {/* Pila pendiente */}
          <PilaMovimientos
            pila={pila}
            onEliminar={eliminar}
            onEnviar={handleEnviar}
            enviando={enviando}
            tipo={tipo}
          />

          {/* Movimientos ya en la DB */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className={`px-5 py-4 rounded-t-2xl flex items-center justify-between ${isIngreso ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">🗄️</span>
                <div>
                  <h3 className="font-bold text-gray-800">Movimientos en la DB</h3>
                  <p className="text-xs text-gray-500">Registros del arco actual</p>
                </div>
              </div>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white
                ${isIngreso ? 'bg-emerald-500' : 'bg-red-500'}`}>
                {movimientosDB.length}
              </span>
            </div>

            <div className="p-4 min-h-[80px] max-h-80 overflow-y-auto">
              {loadingDB ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : movimientosDB.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-gray-400">
                  <span className="text-3xl mb-1">📭</span>
                  <p className="text-sm">No hay movimientos en el arco actual</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {movimientosDB.map((m) => (
                    <div key={m.movement_id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${isIngreso ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmt(m.amount)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(m.movement_date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {m.details && <p className="text-xs text-gray-400 truncate">{m.details}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteDB(m.movement_id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-xl"
                        title="Eliminar"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
