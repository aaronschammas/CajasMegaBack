'use client'

// ─── Modal: Crear nueva propiedad ─────────────────────────────────────────────
// Con toggle pesos/dólares, imágenes, metadata, frecuencia de actualización.

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useNotification } from '@/components/ui/Notification'
import { createPropiedad } from '@/lib/api/alquileres'
import { Propiedad } from '@/types/alquiler'
import { fileToBase64 } from './helpers'

type Modalidad = 'pesos' | 'dolares'

interface FormState {
  direccion:             string
  inquilino:             string
  ocupada:               boolean
  alquiler_mensual:      string
  indice_inflacion:      string
  fecha_actualizacion:   string
  frecuencia_actualizacion: string
  monto_dolares:         string
  alquiler_dolares_ars:  string
}

const FORM_INICIAL: FormState = {
  direccion: '', inquilino: '', ocupada: true,
  alquiler_mensual: '', indice_inflacion: '',
  fecha_actualizacion: '', frecuencia_actualizacion: '3',
  monto_dolares: '', alquiler_dolares_ars: '',
}

interface Props {
  open:      boolean
  onClose:   () => void
  onSuccess: (prop: Propiedad) => void
}

export function ModalCrearPropiedad({ open, onClose, onSuccess }: Props) {
  const { show }    = useNotification()
  const [modalidad, setModalidad] = useState<Modalidad>('pesos')
  const [form, setForm]           = useState<FormState>(FORM_INICIAL)
  const [imagenes, setImagenes]   = useState<string[]>([])
  const [meta, setMeta]           = useState<Record<string, string>>({})
  const [metaKey, setMetaKey]     = useState('')
  const [metaVal, setMetaVal]     = useState('')
  const [guardando, setGuardando] = useState(false)

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const resetForm = () => {
    setForm(FORM_INICIAL)
    setModalidad('pesos')
    setImagenes([])
    setMeta({})
    setMetaKey(''); setMetaVal('')
  }

  // ── Imágenes ──────────────────────────────────────────────────────────────
  const onSubirImagenes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const b64   = await Promise.all(files.map(fileToBase64))
    setImagenes((prev) => [...prev, ...b64])
    e.target.value = ''
  }

  // ── Metadata ──────────────────────────────────────────────────────────────
  const addMeta = () => {
    if (!metaKey.trim() || !metaVal.trim()) { show('Completá clave y valor', 'warning'); return }
    setMeta((m) => ({ ...m, [metaKey]: metaVal }))
    setMetaKey(''); setMetaVal('')
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = async () => {
    if (!form.direccion.trim()) { show('La dirección es obligatoria', 'warning'); return }

    let payload: Partial<Propiedad>

    if (modalidad === 'dolares') {
      const montoDolares = parseFloat(form.monto_dolares)
      if (!montoDolares || montoDolares <= 0) { show('El monto en USD es obligatorio', 'warning'); return }
      payload = {
        direccion:         form.direccion,
        inquilino:         form.inquilino || undefined,
        ocupada:           form.ocupada,
        alquiler_mensual:  parseFloat(form.alquiler_dolares_ars) || 0,
        paga_en_dolares:   true,
        monto_dolares:     montoDolares,
        imagenes,
        metadata:          meta,
      }
    } else {
      const alquiler = parseFloat(form.alquiler_mensual)
      if (!alquiler || alquiler <= 0) { show('El alquiler mensual debe ser mayor a 0', 'warning'); return }
      const frecRaw = parseInt(form.frecuencia_actualizacion) || 0
      const frecuencia = frecRaw >= 3 ? frecRaw : (frecRaw > 0 ? 3 : 0)
      payload = {
        direccion:                form.direccion,
        inquilino:                form.inquilino || undefined,
        ocupada:                  form.ocupada,
        alquiler_mensual:         alquiler,
        paga_en_dolares:          false,
        indice_inflacion:         parseFloat(form.indice_inflacion) || 0,
        fecha_actualizacion:      form.fecha_actualizacion
                                    ? new Date(form.fecha_actualizacion).toISOString()
                                    : undefined,
        frecuencia_actualizacion: frecuencia,
        imagenes,
        metadata:                 meta,
      }
    }

    setGuardando(true)
    try {
      const res = await createPropiedad(payload)
      show('✅ Propiedad creada', 'success')
      resetForm()
      onSuccess(res.propiedad)
      onClose()
    } catch (err: any) {
      show(err.message, 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { resetForm(); onClose() }}
      title="🏢 Nueva Propiedad"
      maxWidth="max-w-2xl"
      footer={
        <>
          <button onClick={() => { resetForm(); onClose() }}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold transition-colors flex items-center gap-2">
            {guardando ? <><span className="animate-spin">⏳</span> Guardando…</> : '💾 Guardar'}
          </button>
        </>
      }
    >
      <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">

        {/* ── Datos básicos ────────────────────────────────────────────── */}
        <Section title="Datos básicos">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Dirección / Identificación *</Label>
              <input type="text" value={form.direccion} onChange={set('direccion')}
                placeholder="Ej: Av. San Martín 1234"
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
            </div>
            <div>
              <Label>Inquilino</Label>
              <input type="text" value={form.inquilino} onChange={set('inquilino')}
                placeholder="Nombre del inquilino"
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
            </div>
            <div>
              <Label>¿Ocupada?</Label>
              <select value={String(form.ocupada)}
                onChange={(e) => setForm((f) => ({ ...f, ocupada: e.target.value === 'true' }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none">
                <option value="true">Sí, ocupada</option>
                <option value="false">No, desocupada</option>
              </select>
            </div>
          </div>
        </Section>

        {/* ── Tipo de contrato ─────────────────────────────────────────── */}
        <Section title="Tipo de contrato">
          <div className="flex gap-3 mb-4">
            {(['pesos', 'dolares'] as Modalidad[]).map((m) => (
              <label key={m} className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors
                ${modalidad === m ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="modalidad" value={m}
                  checked={modalidad === m} onChange={() => setModalidad(m)} className="sr-only" />
                <span className="text-xl">{m === 'pesos' ? '🔵' : '💵'}</span>
                <div>
                  <p className="font-semibold text-sm text-gray-800">
                    {m === 'pesos' ? 'Pesos (con actualización)' : 'Dólares (monto fijo USD)'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {m === 'pesos' ? 'Actualización por inflación INDEC' : 'Sin actualización automática'}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {modalidad === 'pesos' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Alquiler Mensual (ARS) *</Label>
                <input type="number" value={form.alquiler_mensual} onChange={set('alquiler_mensual')}
                  placeholder="0.00" min={0} step={0.01}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
              </div>
              <div>
                <Label>Índice de Inflación pactado (%)</Label>
                <input type="number" value={form.indice_inflacion} onChange={set('indice_inflacion')}
                  placeholder="Ej: 5.0" min={0} step={0.1}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
              </div>
              <div>
                <Label>Fecha próxima actualización</Label>
                <input type="date" value={form.fecha_actualizacion} onChange={set('fecha_actualizacion')}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
              </div>
              <div>
                <Label>Frecuencia de actualización (meses, mín. 3)</Label>
                <input type="number" value={form.frecuencia_actualizacion} onChange={set('frecuencia_actualizacion')}
                  placeholder="3, 6 ó 12" min={3} step={1}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
              </div>
              <div className="col-span-2 bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-600 flex items-center gap-2">
                🔔 Cuando llegue la fecha de actualización, el sistema te notificará con el IPC acumulado (datos INDEC).
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto fijo en USD *</Label>
                <input type="number" value={form.monto_dolares} onChange={set('monto_dolares')}
                  placeholder="Ej: 500" min={0} step={0.01}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
              </div>
              <div>
                <Label>Alquiler en ARS (cotización actual)</Label>
                <input type="number" value={form.alquiler_dolares_ars} onChange={set('alquiler_dolares_ars')}
                  placeholder="Opcional" min={0} step={0.01}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
              </div>
              <div className="col-span-2 bg-green-50 rounded-xl px-4 py-3 text-xs text-green-600 flex items-center gap-2">
                ℹ️ En modalidad dólares, el monto en ARS se actualiza manualmente cada mes con la cotización vigente.
              </div>
            </div>
          )}
        </Section>

        {/* ── Imágenes ─────────────────────────────────────────────────── */}
        <Section title="Imágenes de la propiedad">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium cursor-pointer transition-colors">
            📎 Seleccionar imágenes
            <input type="file" accept="image/*" multiple className="hidden" onChange={onSubirImagenes} />
          </label>
          {imagenes.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-3">
              {imagenes.map((src, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setImagenes((imgs) => imgs.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs transition-opacity">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Metadata ─────────────────────────────────────────────────── */}
        <Section title="Datos adicionales (opcionales)">
          {Object.keys(meta).length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {Object.entries(meta).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs group">
                  <span><strong>{k}:</strong> {v}</span>
                  <button onClick={() => setMeta((m) => { const n = { ...m }; delete n[k]; return n })}
                    className="opacity-0 group-hover:opacity-100 text-red-400 ml-2">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={metaKey} onChange={(e) => setMetaKey(e.target.value)}
              placeholder="Clave (ej: DNI, teléfono)"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-300 focus:outline-none" />
            <input value={metaVal} onChange={(e) => setMetaVal(e.target.value)}
              placeholder="Valor"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-300 focus:outline-none" />
            <button onClick={addMeta}
              className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">
              +
            </button>
          </div>
        </Section>
      </div>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-1">
        {title}
      </p>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>
}
