'use client'

// ─── Modal de detalle de movimientos (con tabs personal/global) ───────────────

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useAppStore } from '@/lib/store/appStore'
import { useRBAC } from '@/lib/hooks/useRBAC'
import { getMovimientosArco, getMovimientosGlobal } from '@/lib/api/movimientos'
import { deleteMovimiento } from '@/lib/api/movimientos'
import { useNotification } from '@/components/ui/Notification'
import { Movimiento } from '@/types/movimiento'

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = 'personal' | 'global'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

export function MovimientosModal({ open, onClose }: Props) {
  const { arco } = useAppStore()
  const { isAdmin } = useRBAC()
  const { show } = useNotification()
  const admin = isAdmin()

  const [tab, setTab] = useState<Tab>('personal')
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = async (vista: Tab) => {
    setLoading(true)
    setError(null)
    setMovimientos([])
    try {
      if (vista === 'global') {
        const data = await getMovimientosGlobal()
        setMovimientos(data.movements)
      } else {
        if (!arco?.id) { setError('No hay arqueo abierto'); return }
        const data = await getMovimientosArco(arco.id)
        setMovimientos(data.movements)
      }
    } catch {
      setError('Error al cargar movimientos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) cargar(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab])

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este movimiento?')) return
    try {
      await deleteMovimiento(id)
      setMovimientos((prev) => prev.filter((m) => m.movement_id !== id))
      show('Movimiento eliminado', 'success')
    } catch (err: any) {
      show(err.message, 'error')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📋 Detalle de Movimientos"
      maxWidth="max-w-2xl"
      footer={
        <button onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
          Cerrar
        </button>
      }
    >
      {/* Tabs (solo admin) */}
      {admin && (
        <div className="flex border-b border-gray-200 mb-4 -mx-6 px-6">
          {(['personal', 'global'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2
                ${tab === t
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'personal' ? '🏠 Mi Caja Personal' : '🌐 Caja Global'}
            </button>
          ))}
        </div>
      )}

      {/* Contenido */}
      <div className="max-h-96 overflow-y-auto -mx-2 px-2">
        {loading && (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-3" />
            <p>Cargando movimientos…</p>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12 text-amber-600">
            <p className="text-4xl mb-2">⚠️</p>
            <p className="font-medium">{error}</p>
          </div>
        )}

        {!loading && !error && movimientos.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">📭</p>
            <p>No hay movimientos en este arco</p>
          </div>
        )}

        {!loading && !error && movimientos.map((m) => {
          const isIngreso = m.movement_type === 'Ingreso'
          return (
            <div key={m.movement_id} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isIngreso ? 'bg-emerald-100' : 'bg-red-100'}`}>
                <span className="text-lg">{isIngreso ? '⬆️' : '⬇️'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-800 text-sm">{m.movement_type}</span>
                  <span className={`font-bold text-base ${isIngreso ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmt(m.amount)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {m.concept?.concept_name ?? `Concepto ${m.concept_id}`}
                  {m.details ? ` · ${m.details}` : ''}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(m.movement_date).toLocaleString('es-AR')}
                  {m.creator ? ` · ${m.creator.full_name}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDelete(m.movement_id)}
                className="text-gray-300 hover:text-red-500 transition-colors text-xl shrink-0"
                title="Eliminar movimiento"
              >×</button>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
