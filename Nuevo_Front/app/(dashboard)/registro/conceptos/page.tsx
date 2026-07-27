'use client'

// ─── Página: Gestión de Conceptos (ABM) ──────────────────────────────────────
// Equivale a registro_conceptos.html + registro-conceptos.js

import { useState, useEffect, useCallback } from 'react'
import { CrudTable, Column } from '@/components/admin/CrudTable'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useNotification } from '@/components/ui/Notification'
import { useRBAC } from '@/lib/hooks/useRBAC'
import {
  getConceptos,
  createConcepto,
  updateConcepto,
  deleteConcepto,
} from '@/lib/api/conceptos'
import { Concepto } from '@/types/concepto'
import Link from 'next/link'

// Mapa de tipos a variante de Badge
const TIPO_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning'> = {
  Ingreso: 'success',
  Egreso:  'danger',
  RetiroCaja: 'warning',
  Ambos:   'info',
}

const TIPO_LABELS: Record<string, string> = {
  Ingreso: 'Ingreso',
  Egreso:  'Egreso',
  RetiroCaja: 'Retiro de Caja',
  Ambos:   'Ingreso / Egreso',
}

// ─── Estado del formulario ────────────────────────────────────────────────────
interface FormState {
  concept_name: string
  concept_type: 'Ingreso' | 'Egreso' | 'RetiroCaja' | 'Ambos'
  description: string
  is_active: boolean
}

const FORM_INICIAL: FormState = {
  concept_name: '',
  concept_type: 'Ingreso',
  description:  '',
  is_active:    true,
}

export default function ConceptosPage() {
  const { can } = useRBAC()
  const { show } = useNotification()

  const [conceptos, setConceptos] = useState<Concepto[]>([])
  const [loading, setLoading]     = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen]   = useState(false)
  const [editando, setEditando]     = useState<Concepto | null>(null)
  const [form, setForm]             = useState<FormState>(FORM_INICIAL)
  const [errores, setErrores]       = useState<Partial<FormState>>({})

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      setConceptos(await getConceptos())
    } catch (err: any) {
      show(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => { cargar() }, [cargar])

  // ── Abrir modal ───────────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setEditando(null)
    setForm(FORM_INICIAL)
    setErrores({})
    setModalOpen(true)
  }

  const abrirEditar = (c: Concepto) => {
    setEditando(c)
    setForm({
      concept_name: c.concept_name,
      concept_type: c.concept_type,
      description:  c.description ?? '',
      is_active:    c.is_active,
    })
    setErrores({})
    setModalOpen(true)
  }

  // ── Validación ────────────────────────────────────────────────────────────
  const validar = (): boolean => {
    const e: Partial<FormState> = {}
    if (!form.concept_name.trim()) e.concept_name = 'El nombre es requerido' as any
    if (!form.concept_type)        e.concept_type  = 'El tipo es requerido' as any
    setErrores(e)
    return Object.keys(e).length === 0
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    try {
      if (editando) {
        await updateConcepto(editando.id, form)
        show('✅ Concepto actualizado', 'success')
      } else {
        await createConcepto(form)
        show('✅ Concepto creado', 'success')
      }
      setModalOpen(false)
      cargar()
    } catch (err: any) {
      show(err.message, 'error')
    } finally {
      setGuardando(false)
    }
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const eliminar = async (c: Concepto) => {
    if (!confirm(`¿Eliminar el concepto "${c.concept_name}"?\n\nEsta acción no se puede deshacer.`)) return
    try {
      await deleteConcepto(c.id)
      show('Concepto eliminado', 'success')
      cargar()
    } catch (err: any) {
      show(err.message, 'error')
    }
  }

  // ── Definición de columnas ────────────────────────────────────────────────
  const columnas: Column<Concepto>[] = [
    {
      key: 'id',
      header: '#',
      render: (c) => <span className="text-gray-400 text-xs">{c.id}</span>,
    },
    {
      key: 'concept_name',
      header: 'Nombre',
      render: (c) => (
        <span className="font-semibold text-gray-800 flex items-center gap-2">
          🏷️ {c.concept_name}
        </span>
      ),
    },
    {
      key: 'concept_type',
      header: 'Tipo',
      render: (c) => (
        <Badge variant={TIPO_BADGE[c.concept_type] ?? 'info'}>
          {TIPO_LABELS[c.concept_type] ?? c.concept_type}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (c) => (
        <Badge variant={c.is_active ? 'success' : 'danger'}>
          {c.is_active ? '● Activo' : '○ Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'description',
      header: 'Descripción',
      render: (c) => (
        <span className="text-gray-500 text-xs max-w-[180px] truncate block">
          {c.description || '—'}
        </span>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (c) => (
        <div className="flex gap-2">
          <button
            onClick={() => abrirEditar(c)}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
            title="Editar"
          >
            ✏️
          </button>
          <button
            onClick={() => eliminar(c)}
            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
            title="Eliminar"
          >
            🗑️
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="page-shell space-y-6">
      {/* Encabezado */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/movimientos" className="hover:text-blue-500 transition-colors">← Dashboard</Link>
          <span>/</span>
          <span>Registro</span>
          <span>/</span>
          <span>Conceptos</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">🏷️ Gestión de Conceptos</h1>
        <p className="text-gray-500 text-sm mt-1">ABM de conceptos de ingresos y egresos</p>
      </div>

      {/* Tabla */}
      <CrudTable
        items={conceptos}
        columns={columnas}
        keyField="id"
        onNew={abrirNuevo}
        newLabel="+ Nuevo Concepto"
        loading={loading}
        emptyText="No hay conceptos registrados"
        searchPlaceholder="Buscar por nombre o tipo…"
        getSearchText={(c) => `${c.concept_name} ${c.concept_type} ${c.description ?? ''}`}
      />

      {/* Modal crear/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Concepto' : '➕ Nuevo Concepto'}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold transition-colors flex items-center gap-2"
            >
              {guardando ? <><span className="animate-spin">⏳</span> Guardando…</> : '💾 Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.concept_name}
              onChange={(e) => setForm((f) => ({ ...f, concept_name: e.target.value }))}
              placeholder="Ej: Alquiler, Servicios, Sueldos…"
              className={`w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none
                ${errores.concept_name ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
            />
            {errores.concept_name && (
              <p className="text-red-500 text-xs mt-1">{String(errores.concept_name)}</p>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de movimiento <span className="text-red-500">*</span>
            </label>
            <select
              value={form.concept_type}
              onChange={(e) => setForm((f) => ({ ...f, concept_type: e.target.value as any }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
            >
              <option value="Ingreso">Ingreso</option>
              <option value="Egreso">Egreso</option>
              <option value="Ambos">Ingreso / Egreso</option>
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Descripción opcional…"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-300 focus:outline-none"
            />
          </div>

          {/* Estado (solo en edición) */}
          {editando && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Concepto activo
              </label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
