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
import { AppIcon, AppIconName } from '@/components/ui/AppIcon'

const fechaHoy = () => new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date())

export default function MovimientosPage() {
  const router = useRouter()
  const { arcoAbierto, tipoCaja, setTipoCaja, user } = useAppStore()
  const { recargar } = useArco()
  const { isAdmin, can } = useRBAC()
  const { show } = useNotification()
  const [showModal, setShowModal] = useState(false)
  const admin = isAdmin()

  useEffect(() => { recargar() }, [tipoCaja, recargar])

  const navegar = (ruta: '/ingresos' | '/egresos') => {
    if (!arcoAbierto) {
      show('Debes abrir un arqueo antes de registrar movimientos', 'warning')
      return
    }
    router.push(ruta)
  }

  const handleCambiarTipoCaja = (tipo: 'personal' | 'global') => {
    setTipoCaja(tipo)
    show(`Cambiando a ${tipo === 'global' ? 'Caja Global' : 'Caja Personal'}…`, 'info')
  }

  return (
    <div className="page-shell space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-6 text-white shadow-sm sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="mb-1 text-sm font-medium text-blue-100">Bienvenido,</p>
            <h1 className="text-2xl font-bold sm:text-3xl">{user?.full_name || 'Usuario'}</h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-blue-100">
              <AppIcon name="calendar" className="h-4 w-4" />
              <span className="first-letter:uppercase">{fechaHoy()}</span>
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
            <p className="text-xs font-medium text-blue-100">Estado del arqueo</p>
            <p className="mt-1 flex items-center gap-2 font-bold">
              <span className={`h-2.5 w-2.5 rounded-full ${arcoAbierto ? 'bg-emerald-300' : 'bg-amber-300'}`} />
              {arcoAbierto ? 'Arqueo abierto' : 'Arqueo cerrado'}
            </p>
          </div>
        </div>
      </section>

      <header>
        <h2 className="page-heading">Control de Caja</h2>
        <p className="page-subtitle">Elegí una acción para comenzar o consultá el estado de la caja.</p>
      </header>

      {admin && (
        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <AppIcon name="wallet" />
              </span>
              <div>
                <label htmlFor="tipo-caja" className="block font-bold text-slate-800">¿Qué caja querés ver?</label>
                <p className="text-sm text-slate-500">La selección cambia los saldos y movimientos mostrados.</p>
              </div>
            </div>
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <select
                id="tipo-caja"
                value={tipoCaja}
                onChange={(event) => handleCambiarTipoCaja(event.target.value as 'personal' | 'global')}
                className="control-input min-w-0 flex-1 cursor-pointer font-semibold sm:min-w-[260px]"
              >
                <option value="personal">Mi Caja Personal</option>
                <option value="global">Caja Global (Todos)</option>
              </select>
              <span className="hidden whitespace-nowrap rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 md:inline">
                Caja activa
              </span>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Acciones principales">
        <ActionButton
          title="Registrar Ingreso"
          description="Anotar una entrada de dinero"
          icon="income"
          tone="success"
          onClick={() => navegar('/ingresos')}
        />
        <ActionButton
          title="Registrar Egreso"
          description="Anotar una salida de dinero"
          icon="expense"
          tone="danger"
          onClick={() => navegar('/egresos')}
        />
      </section>

      <SaldoCard />

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <section className="surface-card p-3 sm:p-4">
          <p className="px-2 pb-2 text-sm font-bold text-slate-500">Otras acciones</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <DashboardLink href="/historial" icon="history" label="Ver todos los movimientos" />
            {can('alquileres:view') && <DashboardLink href="/alquileres" icon="building" label="Gestión de Alquileres" />}
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-2 flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><AppIcon name="eye" className="h-4 w-4" /></span>
              Ver detalle del saldo
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </section>
        <div className="min-w-0 lg:w-[360px]">
          <ArqueoToggle />
        </div>
      </div>

      <MovimientosModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}

function ActionButton({ title, description, icon, tone, onClick }: {
  title: string
  description: string
  icon: AppIconName
  tone: 'success' | 'danger'
  onClick: () => void
}) {
  const palette = tone === 'success'
    ? 'border-emerald-700 bg-emerald-700 hover:bg-emerald-800'
    : 'border-red-700 bg-red-700 hover:bg-red-800'
  return (
    <button type="button" onClick={onClick} className={`group flex min-h-[118px] items-center gap-4 rounded-2xl border p-5 text-left text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${palette}`}>
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/15">
        <AppIcon name={icon} className="h-7 w-7" />
      </span>
      <span>
        <span className="block text-xl font-bold">{title}</span>
        <span className="mt-1 block text-sm text-white/80">{description}</span>
      </span>
    </button>
  )
}

function DashboardLink({ href, icon, label }: { href: string; icon: AppIconName; label: string }) {
  return (
    <Link href={href} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700">
        <AppIcon name={icon} className="h-4 w-4" />
      </span>
      {label}
    </Link>
  )
}
