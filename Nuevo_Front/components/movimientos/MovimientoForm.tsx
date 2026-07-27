'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/lib/store/appStore'
import { useArco } from '@/lib/hooks/useArco'
import { usePila } from '@/lib/hooks/usePila'
import { getConceptosPorTipo } from '@/lib/api/conceptos'
import { deleteMovimiento, enviarPila, getMovimientosArco } from '@/lib/api/movimientos'
import { PilaMovimientos } from '@/components/pila/PilaMovimientos'
import { useNotification } from '@/components/ui/Notification'
import { AppIcon } from '@/components/ui/AppIcon'
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

  const [amount, setAmount] = useState('')
  const [shift, setShift] = useState<'M' | 'T'>('M')
  const [conceptId, setConceptId] = useState<number | ''>('')
  const [details, setDetails] = useState('')
  const [conceptos, setConceptos] = useState<Concepto[]>([])
  const [movimientosDB, setMovimientosDB] = useState<Movimiento[]>([])
  const [loadingDB, setLoadingDB] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    getConceptosPorTipo(tipo)
      .then(setConceptos)
      .catch(() => show('No se pudieron cargar los conceptos', 'error'))
  }, [tipo, show])

  const cargarMovimientosDB = useCallback(async () => {
    if (!arco?.id) return
    setLoadingDB(true)
    try {
      const data = await getMovimientosArco(arco.id)
      setMovimientosDB(data.movements.filter((movement) => movement.movement_type === tipo))
    } catch {
      show('No se pudieron cargar los movimientos', 'error')
    } finally {
      setLoadingDB(false)
    }
  }, [arco?.id, tipo, show])

  useEffect(() => { cargarMovimientosDB() }, [cargarMovimientosDB])

  const handleAgregar = () => {
    if (!arcoAbierto || !arco?.id) {
      show('Debés abrir un arqueo para registrar movimientos', 'warning')
      return
    }
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      show('Ingresá un monto válido', 'warning')
      return
    }
    if (!conceptId) {
      show('Seleccioná un concepto', 'warning')
      return
    }
    if (!user?.user_id) {
      show('Usuario no identificado', 'error')
      return
    }

    const movement: MovimientoPendiente = {
      movement_type: tipo,
      amount: parsedAmount,
      shift,
      concept_id: Number(conceptId),
      details: details.trim() || undefined,
      created_by: user.user_id,
      arco_id: arco.id,
      fecha: new Date().toLocaleDateString('es-AR'),
    }

    agregar(movement)
    setAmount('')
    setDetails('')
    show('Movimiento agregado a la pila', 'success')
  }

  const handleEnviar = async () => {
    if (!arcoAbierto || !arco?.id) {
      show('No hay arqueo abierto', 'error')
      return
    }
    if (pila.length === 0) {
      show('La pila está vacía', 'warning')
      return
    }
    setEnviando(true)
    try {
      const cantidad = pila.length
      await enviarPila(tipo, pila)
      vaciar()
      await cargarMovimientosDB()
      show(`${cantidad} movimiento(s) guardados`, 'success')
      setTimeout(() => router.push('/movimientos'), 800)
    } catch (error: any) {
      show(error.message ?? 'Error al enviar movimientos', 'error')
    } finally {
      setEnviando(false)
    }
  }

  const handleDeleteDB = async (id: number) => {
    if (!confirm('¿Eliminar este movimiento?')) return
    try {
      await deleteMovimiento(id)
      setMovimientosDB((previous) => previous.filter((movement) => movement.movement_id !== id))
      show('Movimiento eliminado', 'success')
    } catch (error: any) {
      show(error.message, 'error')
    }
  }

  const tone = isIngreso
    ? {
        icon: 'income' as const,
        title: 'Registrar Ingreso',
        description: 'Anotá una entrada de dinero al arqueo actual.',
        accent: 'text-emerald-700',
        soft: 'bg-emerald-50 text-emerald-700',
        button: 'bg-emerald-700 hover:bg-emerald-800',
      }
    : {
        icon: 'expense' as const,
        title: 'Registrar Egreso',
        description: 'Anotá una salida de dinero del arqueo actual.',
        accent: 'text-red-700',
        soft: 'bg-red-50 text-red-700',
        button: 'bg-red-700 hover:bg-red-800',
      }

  return (
    <div className="page-shell space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/movimientos" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-700">
            <AppIcon name="arrow-left" className="h-4 w-4" />
            Volver al inicio
          </Link>
          <div className="flex items-center gap-3">
            <span className={`grid h-12 w-12 place-items-center rounded-xl ${tone.soft}`}>
              <AppIcon name={tone.icon} className="h-6 w-6" />
            </span>
            <div>
              <h1 className="page-heading">{tone.title}</h1>
              <p className="page-subtitle">{tone.description}</p>
            </div>
          </div>
        </div>
        <Link href={isIngreso ? '/egresos' : '/ingresos'} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
          <AppIcon name={isIngreso ? 'expense' : 'income'} className="h-4 w-4" />
          Ir a {isIngreso ? 'Egresos' : 'Ingresos'}
        </Link>
      </header>

      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <AppIcon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
        <p>Completá los campos obligatorios, agregá el movimiento a la pila y revisalo antes de enviarlo a la base de datos.</p>
      </div>

      {!arcoAbierto && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <AppIcon name="alert" className="h-5 w-5 shrink-0" />
          <span>No hay arqueo abierto. Volvé al inicio para abrirlo antes de registrar movimientos.</span>
        </div>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
        <section className="surface-card min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone.soft}`}><AppIcon name={tone.icon} className="h-5 w-5" /></span>
              <div>
                <h2 className="font-bold text-slate-900">Datos del nuevo {tipo.toLowerCase()}</h2>
                <p className="text-xs text-slate-500">Los campos con * son obligatorios.</p>
              </div>
            </div>
            <span className={`hidden rounded-full px-3 py-1 text-xs font-bold sm:inline-flex ${arcoAbierto ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {arcoAbierto ? 'Arqueo abierto' : 'Arqueo cerrado'}
            </span>
          </div>

          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <div className="sm:col-span-2">
              <label htmlFor="movement-amount" className="control-label">Monto *</label>
              <input id="movement-amount" type="number" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} step="0.01" min="0" placeholder="Ej.: 120000,00" disabled={!arcoAbierto} className="control-input text-lg font-semibold disabled:cursor-not-allowed disabled:bg-slate-50" />
              <p className="mt-1.5 text-xs text-slate-500">Ingresá un monto mayor que cero.</p>
            </div>

            <div>
              <label htmlFor="movement-concept" className="control-label">Concepto *</label>
              <select id="movement-concept" value={conceptId} onChange={(event) => setConceptId(event.target.value ? Number(event.target.value) : '')} disabled={!arcoAbierto || conceptos.length === 0} className="control-input disabled:cursor-not-allowed disabled:bg-slate-50">
                <option value="">Seleccioná un concepto</option>
                {conceptos.map((concept) => <option key={concept.id} value={concept.id}>{concept.concept_name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="movement-shift" className="control-label">Turno *</label>
              <select id="movement-shift" value={shift} onChange={(event) => setShift(event.target.value as 'M' | 'T')} disabled={!arcoAbierto} className="control-input disabled:cursor-not-allowed disabled:bg-slate-50">
                <option value="M">Mañana</option>
                <option value="T">Tarde</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="movement-details" className="control-label">Detalle <span className="font-normal text-slate-400">(opcional)</span></label>
              <textarea id="movement-details" value={details} onChange={(event) => setDetails(event.target.value)} rows={4} disabled={!arcoAbierto} placeholder="Agregá una nota que ayude a identificar el movimiento." className="control-input resize-y disabled:cursor-not-allowed disabled:bg-slate-50" />
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <AppIcon name="calendar" className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Fecha</p>
                <p className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString('es-AR')}</p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{(user?.full_name || 'U').charAt(0)}</span>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Registrado por</p>
                <p className="truncate text-sm font-bold text-slate-700">{user?.full_name ?? '—'}</p>
              </div>
            </div>

            <button type="button" onClick={handleAgregar} disabled={!arcoAbierto} className={`sm:col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl font-bold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 ${tone.button}`}>
              <AppIcon name="plus" className="h-5 w-5" />
              Agregar a la pila
            </button>
          </div>
        </section>

        <aside className="min-w-0 space-y-5">
          <PilaMovimientos pila={pila} onEliminar={eliminar} onEnviar={handleEnviar} enviando={enviando} tipo={tipo} />

          <section className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">Ya guardados hoy</h2>
                <p className="text-xs text-slate-500">Movimientos del arqueo actual.</p>
              </div>
              <span className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-sm font-bold ${tone.soft}`}>{movimientosDB.length}</span>
            </div>
            <div className="max-h-80 min-h-[110px] overflow-y-auto p-3">
              {loadingDB ? (
                <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" /></div>
              ) : movimientosDB.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center text-slate-400">
                  <AppIcon name="history" className="mb-2 h-8 w-8" />
                  <p className="text-sm">Todavía no hay movimientos guardados.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {movimientosDB.map((movement) => (
                    <div key={movement.movement_id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-bold ${tone.accent}`}>{fmt(movement.amount)}</span>
                          <span className="text-xs text-slate-400">{new Date(movement.movement_date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {movement.details && <p className="mt-0.5 truncate text-xs text-slate-500">{movement.details}</p>}
                      </div>
                      <button type="button" onClick={() => handleDeleteDB(movement.movement_id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700" title="Eliminar movimiento" aria-label="Eliminar movimiento">
                        <AppIcon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
