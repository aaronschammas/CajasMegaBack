'use client'

// ─── Modal: Detalle de propiedad ──────────────────────────────────────────────
// Calendario de pagos, galería, estadísticas, metadata, acciones.

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useNotification } from '@/components/ui/Notification'
import {
  updatePropiedad, deletePropiedad, deshacerPago,
  deleteMetadataCampo,
} from '@/lib/api/alquileres'
import { Propiedad, EstadoPago } from '@/types/alquiler'
import {
  MESES, MESES_CORTO, ESTADO_ICONO, ESTADO_LABEL, ESTADO_CLASSES,
  fmt, fileToBase64,
} from './helpers'
import { ModalPago } from './ModalPago'

interface Props {
  propiedad:  Propiedad
  open:       boolean
  onClose:    () => void
  onUpdate:   (p: Propiedad) => void   // propagates changes up
  onDelete:   (id: string) => void
  esAdmin:    boolean
}

export function ModalDetalle({ propiedad, open, onClose, onUpdate, onDelete, esAdmin }: Props) {
  const { show } = useNotification()
  const [prop, setProp] = useState<Propiedad>(propiedad)

  // Sync prop when parent changes
  if (propiedad.id !== prop.id) setProp(propiedad)

  // Pago
  const [pagoMes, setPagoMes]       = useState<number | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // Metadata
  const [metaKey, setMetaKey]   = useState('')
  const [metaVal, setMetaVal]   = useState('')
  const [showMetaAdd, setShowMetaAdd] = useState(false)

  // ── helpers locales ───────────────────────────────────────────────────────
  const pagos       = prop.pagos || Array(12).fill({ estado: 'pending', monto: 0 })
  const pagados     = pagos.filter((p) => p.estado === 'paid')
  const recaudado   = pagados.reduce((s, p) => s + (p.monto || 0), 0)
  const mesesPend   = pagos.filter((p) => p.estado !== 'paid').length
  const deuda       = mesesPend * prop.alquiler_mensual
  const esDolar     = prop.paga_en_dolares
  const fechaAct    = prop.fecha_actualizacion ? new Date(prop.fecha_actualizacion) : null
  const mesActIdx   = fechaAct ? fechaAct.getMonth() : -1
  const nuevoAlq    = prop.alquiler_mensual * (1 + (prop.indice_inflacion || 0) / 100)

  const actualizar = (updated: Propiedad) => {
    setProp(updated)
    onUpdate(updated)
  }

  // ── Clic en mes del calendario ────────────────────────────────────────────
  const handleClickMes = async (i: number) => {
    const estado = pagos[i]?.estado as EstadoPago
    if (estado === 'paid') {
      if (!esAdmin) return
      if (!confirm(`¿Revertir el pago de ${MESES[i]}?`)) return
      try {
        const res = await deshacerPago(prop.id, i)
        actualizar(res.propiedad)
        show(`Pago de ${MESES[i]} revertido`, 'info')
      } catch (err: any) { show(err.message, 'error') }
    } else {
      setPagoMes(i)
    }
  }

  // ── Toggle ocupada ────────────────────────────────────────────────────────
  const toggleOcupada = async () => {
    try {
      const res = await updatePropiedad(prop.id, { ocupada: !prop.ocupada })
      actualizar(res.propiedad)
      show(`Propiedad marcada como ${res.propiedad.ocupada ? 'ocupada' : 'desocupada'}`, 'success')
    } catch (err: any) { show(err.message, 'error') }
  }

  // ── Eliminar propiedad ────────────────────────────────────────────────────
  const eliminar = async () => {
    if (!confirm(`¿Eliminar permanentemente "${prop.direccion}"? Esta acción no se puede deshacer.`)) return
    try {
      await deletePropiedad(prop.id)
      show('Propiedad eliminada', 'info')
      onDelete(prop.id)
      onClose()
    } catch (err: any) { show(err.message, 'error') }
  }

  // ── Imágenes ──────────────────────────────────────────────────────────────
  const onSubirImagenes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const nuevas = await Promise.all(files.map(fileToBase64))
    const todas  = [...(prop.imagenes || []), ...nuevas]
    try {
      const res = await updatePropiedad(prop.id, { imagenes: todas })
      actualizar(res.propiedad)
      show(`${nuevas.length} imagen(es) agregada(s)`, 'success')
    } catch (err: any) { show(err.message, 'error') }
    e.target.value = ''
  }

  const eliminarImagen = async (idx: number) => {
    if (!confirm('¿Eliminar esta imagen?')) return
    const nuevas = [...(prop.imagenes || [])]
    nuevas.splice(idx, 1)
    try {
      const res = await updatePropiedad(prop.id, { imagenes: nuevas })
      actualizar(res.propiedad)
    } catch (err: any) { show(err.message, 'error') }
  }

  // ── Metadata ──────────────────────────────────────────────────────────────
  const agregarMeta = async () => {
    if (!metaKey.trim() || !metaVal.trim()) { show('Completá clave y valor', 'warning'); return }
    try {
      const res = await updatePropiedad(prop.id, { metadata: { [metaKey]: metaVal } })
      actualizar(res.propiedad)
      setMetaKey(''); setMetaVal('')
      show('Campo agregado', 'success')
    } catch (err: any) { show(err.message, 'error') }
  }

  const eliminarMeta = async (campo: string) => {
    if (!confirm(`¿Eliminar el campo "${campo}"?`)) return
    try {
      const res = await deleteMetadataCampo(prop.id, campo)
      actualizar(res.propiedad)
    } catch (err: any) { show(err.message, 'error') }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`🏢 ${prop.direccion}`}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              {esAdmin && (
                <button onClick={eliminar}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium transition-colors">
                  🗑️ Eliminar
                </button>
              )}
              <button onClick={toggleOcupada}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">
                {prop.ocupada ? '📦 Marcar Desocupada' : '🏠 Marcar Ocupada'}
              </button>
            </div>
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm">
              Cerrar
            </button>
          </div>
        }
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">

          {/* ── Info básica ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoItem label="Inquilino"        value={prop.inquilino || 'Sin asignar'} color="text-blue-600" />
            <InfoItem label="Alquiler Mensual" value={fmt(prop.alquiler_mensual)}       color="text-emerald-600" />
            <InfoItem
              label="Estado"
              value={prop.ocupada ? 'OCUPADA' : 'DESOCUPADA'}
              color={prop.ocupada ? 'text-emerald-600' : 'text-red-500'}
            />
            {esDolar ? (
              <>
                <InfoItem label="Modalidad"  value="💵 Dólares"                color="text-green-600" />
                <InfoItem label="Monto USD"  value={`USD ${prop.monto_dolares}`} color="text-green-600" />
              </>
            ) : (
              <>
                <InfoItem label="Inflación Pactada"   value={`${prop.indice_inflacion || 0}%`} />
                <InfoItem label="Próxima Actualización"
                  value={fechaAct ? fechaAct.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
              </>
            )}
          </div>

          {/* ── Galería ─────────────────────────────────────────────────── */}
          {((prop.imagenes?.length || 0) > 0 || esAdmin) && (
            <div>
              <h3 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">🖼️ Imágenes</h3>
              {(prop.imagenes?.length || 0) > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {(prop.imagenes || []).map((src, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100">
                      <img src={src} alt="" className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setLightboxSrc(src)} />
                      {esAdmin && (
                        <button onClick={() => eliminarImagen(idx)}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs transition-opacity">
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Sin imágenes cargadas.</p>
              )}
              {esAdmin && (
                <label className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium cursor-pointer transition-colors">
                  📎 Agregar imágenes
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onSubirImagenes} />
                </label>
              )}
            </div>
          )}

          {/* ── Calendario de pagos ──────────────────────────────────────── */}
          <div>
            <h3 className="font-bold text-gray-800 text-sm mb-2">📅 Estado de Pagos</h3>
            <div className="grid grid-cols-6 gap-2">
              {pagos.map((pago, i) => {
                const estado    = pago.estado as EstadoPago
                const esActMes  = !esDolar && mesActIdx === i
                return (
                  <button
                    key={i}
                    onClick={() => handleClickMes(i)}
                    title={`${MESES[i]} — ${ESTADO_LABEL[estado]}`}
                    className={`rounded-xl border p-2 text-center transition-all hover:scale-105
                      ${ESTADO_CLASSES[estado]}
                      ${esActMes ? 'ring-2 ring-cyan-400 ring-offset-1' : ''}`}
                  >
                    <p className="text-xs font-semibold">{MESES_CORTO[i]}</p>
                    <p className="text-sm font-bold">{ESTADO_ICONO[estado]}</p>
                    {pago.estado === 'paid' && pago.monto > 0 && (
                      <p className="text-xs mt-0.5 opacity-70">
                        ${Math.round(pago.monto / 1000)}k
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Estadísticas ─────────────────────────────────────────────── */}
          <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <StatItem label="Pagos realizados" value={`${pagados.length} de 12`}     color="text-emerald-600" />
            <StatItem label="Recaudado"         value={fmt(recaudado)}                color="text-blue-600" />
            <StatItem label="Deuda acumulada"   value={fmt(deuda)}                   color="text-red-500" />
            <StatItem label="Meses pendientes"  value={String(mesesPend)}            color="text-amber-600" />
          </div>

          {/* ── Proyección / info USD ─────────────────────────────────────── */}
          {!esDolar ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
              <p className="text-indigo-600 text-sm mb-1">
                Con inflación del <strong>{prop.indice_inflacion || 0}%</strong>, el nuevo alquiler estimado sería:
              </p>
              <p className="text-2xl font-bold text-indigo-700">{fmt(nuevoAlq)}</p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-600 text-sm mb-1">💵 Contrato en dólares</p>
              <p className="text-2xl font-bold text-green-700">USD {prop.monto_dolares}</p>
              <p className="text-xs text-green-500 mt-1">El monto en ARS se actualiza manualmente cada mes.</p>
            </div>
          )}

          {/* ── Metadata ─────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">ℹ️ Datos Adicionales</h3>
              {esAdmin && (
                <button onClick={() => setShowMetaAdd((v) => !v)}
                  className="text-xs text-blue-500 hover:underline">
                  {showMetaAdd ? '− Ocultar' : '+ Agregar campo'}
                </button>
              )}
            </div>
            {Object.keys(prop.metadata || {}).length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin datos adicionales registrados.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(prop.metadata || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs group">
                    <div>
                      <span className="font-semibold text-gray-600">{k}:</span>
                      <span className="text-gray-800 ml-1">{v}</span>
                    </div>
                    {esAdmin && (
                      <button onClick={() => eliminarMeta(k)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all ml-2">
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {esAdmin && showMetaAdd && (
              <div className="flex gap-2 mt-2">
                <input value={metaKey} onChange={(e) => setMetaKey(e.target.value)}
                  placeholder="Clave (ej: DNI)" className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-300 focus:outline-none" />
                <input value={metaVal} onChange={(e) => setMetaVal(e.target.value)}
                  placeholder="Valor" className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-300 focus:outline-none" />
                <button onClick={agregarMeta}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal de pago */}
      {pagoMes !== null && (
        <ModalPago
          open
          propId={prop.id}
          mes={pagoMes}
          propiedad={prop}
          onClose={() => setPagoMes(null)}
          onSuccess={(updated) => { actualizar(updated); setPagoMes(null) }}
        />
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="" className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain" />
          <button onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center text-xl transition-colors">
            ×
          </button>
        </div>
      )}
    </>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function InfoItem({ label, value, color = 'text-gray-800' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`font-semibold text-sm ${color}`}>{value}</p>
    </div>
  )
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`font-bold text-base ${color}`}>{value}</p>
    </div>
  )
}
