'use client'

// ─── Página: Módulo de Alquileres ─────────────────────────────────────────────
// Equivale a alquileres.html + alquileres.js
// Orquesta: tabla, KPIs, filtros, modales, overlay de actualización.

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRBAC } from '@/lib/hooks/useRBAC'
import { useNotification } from '@/components/ui/Notification'
import { getPropiedades, getResumenKPIs, deshacerPago, getPropiedad } from '@/lib/api/alquileres'
import { Propiedad, ResumenKPIs, FiltroEstado, EstadoPago } from '@/types/alquiler'
import { KPICards }               from '@/components/alquileres/KPICards'
import { ReportePanel }            from '@/components/alquileres/ReportePanel'
import { TablaPropiedades }        from '@/components/alquileres/TablaPropiedades'
import { ModalDetalle }            from '@/components/alquileres/ModalDetalle'
import { ModalCrearPropiedad }     from '@/components/alquileres/ModalCrearPropiedad'
import { ModalPago }               from '@/components/alquileres/ModalPago'
import { ActualizacionOverlay }    from '@/components/alquileres/ActualizacionOverlay'
import { matchFiltro }             from '@/components/alquileres/helpers'

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS_DISPONIBLES = Array.from({ length: 4 }, (_, i) => ANIO_ACTUAL - i)

export default function AlquileresPage() {
  const { isAdmin, can } = useRBAC()
  const { show }         = useNotification()
  const admin            = isAdmin()

  // ── Estado principal ──────────────────────────────────────────────────────
  const [propiedades, setPropiedades] = useState<Propiedad[]>([])
  const [kpis, setKpis]               = useState<ResumenKPIs | null>(null)
  const [loadingTabla, setLoadingTabla] = useState(true)
  const [anio, setAnio]               = useState(ANIO_ACTUAL)

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [busqueda, setBusqueda]       = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('')

  // ── Modales ───────────────────────────────────────────────────────────────
  const [propDetalle, setPropDetalle] = useState<Propiedad | null>(null)
  const [showCrear, setShowCrear]     = useState(false)

  // Pago directo desde la tabla (sin abrir detalle)
  const [pagoDirecto, setPagoDirecto] = useState<{ prop: Propiedad; mes: number } | null>(null)

  // ── Carga de datos ────────────────────────────────────────────────────────
  const cargar = useCallback(async (a: number) => {
    setLoadingTabla(true)
    try {
      const [dataProps, dataKpis] = await Promise.all([
        getPropiedades(a),
        getResumenKPIs(a),
      ])
      setPropiedades(dataProps.propiedades || [])
      setKpis(dataKpis)
    } catch (err: any) {
      show(err.message ?? 'Error al cargar propiedades', 'error')
    } finally {
      setLoadingTabla(false)
    }
  }, [show])

  useEffect(() => { cargar(anio) }, [cargar, anio])

  // ── Contadores por filtro para los botones de leyenda ──────────────────
  const contadores = useMemo(() => ({
    '':            propiedades.length,
    aldia:         propiedades.filter((p) => matchFiltro(p, 'aldia')).length,
    atraso1:       propiedades.filter((p) => matchFiltro(p, 'atraso1')).length,
    atraso2:       propiedades.filter((p) => matchFiltro(p, 'atraso2')).length,
    desocupadas:   propiedades.filter((p) => matchFiltro(p, 'desocupadas')).length,
  }), [propiedades])

  // ── Click en celda de mes (desde la tabla) ────────────────────────────
  const handleClickMes = async (propId: string, mes: number) => {
    const prop = propiedades.find((p) => p.id === propId)
    if (!prop || !prop.ocupada) return
    const estado = (prop.pagos || [])[mes]?.estado as EstadoPago

    if (estado === 'paid') {
      if (!admin) return
      if (!confirm(`¿Revertir el pago de ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][mes]}?`)) return
      try {
        const res = await deshacerPago(propId, mes)
        actualizarProp(res.propiedad)
        show('Pago revertido', 'info')
        recargarKpis()
      } catch (err: any) { show(err.message, 'error') }
    } else {
      setPagoDirecto({ prop, mes })
    }
  }

  // ── Abrir detalle (carga datos frescos del backend) ───────────────────
  const handleVerDetalle = async (propId: string) => {
    try {
      const prop = await getPropiedad(propId)
      setPropDetalle(prop)
    } catch (err: any) {
      show(err.message, 'error')
    }
  }

  // ── Actualiza una propiedad en el array local ─────────────────────────
  const actualizarProp = (updated: Propiedad) => {
    setPropiedades((prev) => prev.map((p) => p.id === updated.id ? updated : p))
    if (propDetalle?.id === updated.id) setPropDetalle(updated)
  }

  const recargarKpis = async () => {
    try { setKpis(await getResumenKPIs(anio)) } catch { /* silencioso */ }
  }

  // ── Eliminar propiedad del array local ────────────────────────────────
  const eliminarPropLocal = (id: string) => {
    setPropiedades((prev) => prev.filter((p) => p.id !== id))
    recargarKpis()
  }

  // ── Filtros rápidos de leyenda ─────────────────────────────────────────
  const filtros: { key: FiltroEstado; label: string; color: string }[] = [
    { key: '',            label: 'Todas',           color: 'bg-gray-400' },
    { key: 'aldia',       label: 'Al día',          color: 'bg-emerald-500' },
    { key: 'atraso1',     label: 'Atrasado (1 mes)',color: 'bg-red-500' },
    { key: 'atraso2',     label: 'Atrasado (2+ m)', color: 'bg-red-900' },
    { key: 'desocupadas', label: 'Desocupadas',     color: 'bg-slate-400' },
  ]

  return (
    <div className="max-w-full px-4 py-6 space-y-5">

      {/* ── Encabezado ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/movimientos" className="hover:text-blue-500 transition-colors">← Dashboard</Link>
            <span>/</span>
            <span>Alquileres</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">🏢 Gestión de Alquileres</h1>
        </div>
        {(admin || can('admin:alquileres')) && (
          <button
            onClick={() => setShowCrear(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            + Nueva Propiedad
          </button>
        )}
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <KPICards kpis={kpis} loading={loadingTabla} />

      {/* ── Panel de reporte (solo Admin) ─────────────────────────────── */}
      {admin && <ReportePanel />}

      {/* ── Leyenda / Filtros rápidos ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {filtros.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltroEstado(f.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors
              ${filtroEstado === f.key
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${f.color}`} />
            {f.label}
            <span className={`text-xs rounded-full px-1.5 py-0.5
              ${filtroEstado === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {contadores[f.key]}
            </span>
          </button>
        ))}

        {/* Leyenda informativa */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 ml-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-cyan-200" />
          Próx. actualización
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300 ring-2 ring-green-500" />
          Paga en USD
        </div>
      </div>

      {/* ── Toolbar: búsqueda + año ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por dirección o inquilino…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none"
          />
        </div>

        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none bg-white"
        >
          {ANIOS_DISPONIBLES.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <button
          onClick={() => cargar(anio)}
          title="Recargar"
          className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors text-sm"
        >
          🔄
        </button>
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────── */}
      <TablaPropiedades
        propiedades={propiedades}
        loading={loadingTabla}
        anio={anio}
        filtroEstado={filtroEstado}
        busqueda={busqueda}
        onClickMes={handleClickMes}
        onVerDetalle={handleVerDetalle}
        esAdmin={admin}
      />

      {/* ── Modal Detalle ──────────────────────────────────────────────── */}
      {propDetalle && (
        <ModalDetalle
          propiedad={propDetalle}
          open={!!propDetalle}
          onClose={() => setPropDetalle(null)}
          onUpdate={(p) => { actualizarProp(p); recargarKpis() }}
          onDelete={eliminarPropLocal}
          esAdmin={admin}
        />
      )}

      {/* ── Modal Crear ────────────────────────────────────────────────── */}
      <ModalCrearPropiedad
        open={showCrear}
        onClose={() => setShowCrear(false)}
        onSuccess={(p) => {
          setPropiedades((prev) => [p, ...prev])
          recargarKpis()
        }}
      />

      {/* ── Modal Pago directo (desde clic en tabla) ──────────────────── */}
      {pagoDirecto && (
        <ModalPago
          open
          propId={pagoDirecto.prop.id}
          mes={pagoDirecto.mes}
          propiedad={pagoDirecto.prop}
          onClose={() => setPagoDirecto(null)}
          onSuccess={(updated) => {
            actualizarProp(updated)
            setPagoDirecto(null)
            recargarKpis()
          }}
        />
      )}

      {/* ── Overlay de actualizaciones INDEC ──────────────────────────── */}
      <ActualizacionOverlay onActualizado={() => cargar(anio)} />
    </div>
  )
}
