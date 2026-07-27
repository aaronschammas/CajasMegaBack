'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/lib/store/appStore'
import { useArco } from '@/lib/hooks/useArco'
import { useRBAC } from '@/lib/hooks/useRBAC'
import { SaldoCard } from '@/components/movimientos/SaldoCard'
import { ArqueoToggle } from '@/components/movimientos/ArqueoToggle'
import { MovimientosModal } from '@/components/movimientos/MovimientosModal'
import { useNotification } from '@/components/ui/Notification'

export default function MovimientosPage() {
  const router = useRouter()
  const { arcoAbierto, tipoCaja, setTipoCaja, user } = useAppStore()
  const { recargar } = useArco()
  const { isAdmin } = useRBAC()
  const { show } = useNotification()

  const [showModal, setShowModal] = useState(false)
  const admin = isAdmin()

  useEffect(() => {
    recargar()
  }, [tipoCaja, recargar])

  const navegar = (ruta: '/ingresos' | '/egresos') => {
    if (!arcoAbierto) {
      show('Debes abrir un arqueo antes de registrar movimientos', 'warning')
      return
    }
    router.push(ruta)
  }

  const handleCambiarTipoCaja = (tipo: 'personal' | 'global') => {
    setTipoCaja(tipo)
    show(`Cambiando a ${tipo === 'global' ? 'Caja Global' : 'Caja Personal'}...`, 'info')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {user && (
        <p className="text-right text-sm text-blue-600 font-medium">
          Bienvenido, <strong>{user.full_name}</strong>
        </p>
      )}

      <h1 className="text-2xl font-bold text-gray-800">Control de Caja</h1>

      {admin && (
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 text-white p-2.5 rounded-xl shadow-sm">
                <span className="text-xl">Caja</span>
              </div>
              <div>
                <p className="font-bold text-gray-800">Vista de Caja</p>
                <p className="text-xs text-gray-500">Selecciona que caja visualizar</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={tipoCaja}
                onChange={(e) => handleCambiarTipoCaja(e.target.value as 'personal' | 'global')}
                className="border-2 border-slate-200 rounded-xl px-4 py-2 font-semibold text-sm bg-white focus:ring-2 focus:ring-blue-300 focus:outline-none cursor-pointer"
              >
                <option value="personal">Mi Caja Personal</option>
                <option value="global">Caja Global (Todos)</option>
              </select>

              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold">
                Admin General
              </span>
            </div>
          </div>

          {tipoCaja === 'global' ? (
            <div className="mt-4 px-4 py-3 bg-amber-50 border-l-4 border-amber-400 rounded-lg text-xs text-amber-800">
              <strong>Caja Global:</strong> Los movimientos aqui afectan a todos los usuarios.
            </div>
          ) : (
            <div className="mt-4 px-4 py-3 bg-blue-50 border-l-4 border-blue-400 rounded-lg text-xs text-blue-800">
              <strong>Caja Personal:</strong> Tus movimientos tambien se replican automaticamente en la Caja Global.
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => navegar('/ingresos')}
          className="group flex flex-col items-center gap-3 bg-white hover:bg-emerald-50 border-2 border-gray-100 hover:border-emerald-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
        >
          <div className="w-14 h-14 bg-emerald-100 group-hover:bg-emerald-200 rounded-2xl flex items-center justify-center text-2xl font-bold text-emerald-600 transition-colors">
            +
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-800">Ingresos</p>
            <p className="text-xs text-gray-400">Registrar entrada de dinero</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navegar('/egresos')}
          className="group flex flex-col items-center gap-3 bg-white hover:bg-red-50 border-2 border-gray-100 hover:border-red-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
        >
          <div className="w-14 h-14 bg-red-100 group-hover:bg-red-200 rounded-2xl flex items-center justify-center text-2xl font-bold text-red-600 transition-colors">
            -
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-800">Egresos</p>
            <p className="text-xs text-gray-400">Registrar salida de dinero</p>
          </div>
        </button>
      </div>

      <SaldoCard />

      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-blue-100 bg-white hover:bg-blue-50 text-blue-600 font-medium text-sm transition-colors"
      >
        <span>Ver detalle del saldo</span>
      </button>

      <Link
        href="/historial"
        className="flex items-center justify-between px-5 py-4 bg-white rounded-2xl border border-gray-100 hover:bg-gray-50 shadow-sm transition-colors group"
      >
        <div className="flex items-center gap-3 text-gray-600 group-hover:text-gray-800">
          <span className="font-medium text-sm">Ver todos los movimientos</span>
        </div>
        <span className="text-gray-300 group-hover:text-gray-500">{'>'}</span>
      </Link>

      <ArqueoToggle />

      <MovimientosModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}
