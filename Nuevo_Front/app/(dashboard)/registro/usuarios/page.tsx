'use client'

// ─── Página: Gestión de Usuarios (ABM) ───────────────────────────────────────
// Equivale a registro_usuarios.html + registro-usuarios.js
// Incluye: crear, editar, desactivar, resetear contraseña.

import { useState, useEffect, useCallback } from 'react'
import { CrudTable, Column } from '@/components/admin/CrudTable'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useNotification } from '@/components/ui/Notification'
import {
  getUsuarios, createUsuario, updateUsuario, deleteUsuario, Usuario,
} from '@/lib/api/usuarios'
import { getRoles, Rol } from '@/lib/api/roles'
import { apiRequest } from '@/lib/api/client'
import Link from 'next/link'

// ─── Tipos de formulario ──────────────────────────────────────────────────────
interface FormUsuario {
  email:     string
  full_name: string
  role_id:   number | ''
  password:  string
  is_active: boolean
}

const FORM_INICIAL: FormUsuario = {
  email: '', full_name: '', role_id: '', password: '', is_active: true,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generarPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function UsuariosPage() {
  const { show } = useNotification()

  const [usuarios, setUsuarios]     = useState<Usuario[]>([])
  const [roles, setRoles]           = useState<Rol[]>([])
  const [loading, setLoading]       = useState(true)
  const [guardando, setGuardando]   = useState(false)

  // Modal principal
  const [modalOpen, setModalOpen]   = useState(false)
  const [editando, setEditando]     = useState<Usuario | null>(null)
  const [form, setForm]             = useState<FormUsuario>(FORM_INICIAL)
  const [errores, setErrores]       = useState<Record<string, string>>({})

  // Modal reset contraseña
  const [resetModal, setResetModal]     = useState(false)
  const [resetUserId, setResetUserId]   = useState<number | null>(null)
  const [nuevaPass, setNuevaPass]       = useState('')
  const [passVisible, setPassVisible]   = useState(false)
  const [reseteando, setReseteando]     = useState(false)

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [u, r] = await Promise.all([getUsuarios(), getRoles()])
      setUsuarios(u)
      setRoles(r)
    } catch (err: any) {
      show(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => { cargar() }, [cargar])

  // ── Modal principal ───────────────────────────────────────────────────────
  const abrirNuevo = () => {
    setEditando(null)
    setForm({ ...FORM_INICIAL, role_id: roles[0]?.id ?? '' })
    setErrores({})
    setModalOpen(true)
  }

  const abrirEditar = (u: Usuario) => {
    setEditando(u)
    setForm({
      email:     u.email,
      full_name: u.full_name,
      role_id:   u.role_id,
      password:  '',
      is_active: u.is_active,
    })
    setErrores({})
    setModalOpen(true)
  }

  // ── Validación ────────────────────────────────────────────────────────────
  const validar = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.full_name.trim())       e.full_name = 'El nombre es requerido'
    if (!form.role_id)                e.role_id   = 'Seleccioná un rol'
    if (!editando) {
      if (!form.email.trim())         e.email     = 'El email es requerido'
      if (!form.password)             e.password  = 'La contraseña es requerida'
      if (form.password.length < 8)   e.password  = 'Mínimo 8 caracteres'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    try {
      const payload: any = {
        full_name: form.full_name,
        role_id:   Number(form.role_id),
        is_active: form.is_active,
      }
      if (!editando) {
        payload.email    = form.email
        payload.password = form.password
        await createUsuario(payload)
        show('✅ Usuario creado', 'success')
      } else {
        await updateUsuario(editando.user_id, payload)
        show('✅ Usuario actualizado', 'success')
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
  const eliminar = async (u: Usuario) => {
    if (!confirm(`¿Eliminar al usuario "${u.full_name}"?`)) return
    try {
      await deleteUsuario(u.user_id)
      show('Usuario eliminado', 'success')
      cargar()
    } catch (err: any) {
      show(err.message, 'error')
    }
  }

  // ── Reset contraseña ──────────────────────────────────────────────────────
  const abrirReset = (u: Usuario) => {
    setResetUserId(u.user_id)
    setNuevaPass('')
    setPassVisible(false)
    setResetModal(true)
  }

  const confirmarReset = async () => {
    if (nuevaPass.length < 8) { show('Mínimo 8 caracteres', 'warning'); return }
    if (!resetUserId) return
    setReseteando(true)
    try {
      await apiRequest(`/api/admin/usuarios/${resetUserId}/reset-password`, {
        method: 'POST',
        body: { new_password: nuevaPass },
      })
      show(`✅ Contraseña actualizada: ${nuevaPass}`, 'success')
      setResetModal(false)
    } catch (err: any) {
      show(err.message, 'error')
    } finally {
      setReseteando(false)
    }
  }

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: Column<Usuario>[] = [
    {
      key: 'user_id',
      header: '#',
      render: (u) => <span className="text-gray-400 text-xs">{u.user_id}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (u) => <span className="font-semibold text-gray-800">📧 {u.email}</span>,
    },
    {
      key: 'full_name',
      header: 'Nombre',
      render: (u) => <span className="text-gray-700">{u.full_name}</span>,
    },
    {
      key: 'role',
      header: 'Rol',
      render: (u) => (
        <Badge variant="info">
          {u.role?.role_name ?? `Rol #${u.role_id}`}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (u) => (
        <Badge variant={u.is_active ? 'success' : 'danger'}>
          {u.is_active ? '● Activo' : '○ Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (u) => (
        <div className="flex gap-1.5">
          <button
            onClick={() => abrirEditar(u)}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
            title="Editar"
          >✏️</button>
          <button
            onClick={() => abrirReset(u)}
            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors"
            title="Resetear contraseña"
          >🔑</button>
          <button
            onClick={() => eliminar(u)}
            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
            title="Eliminar"
          >🗑️</button>
        </div>
      ),
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Encabezado */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/movimientos" className="hover:text-blue-500 transition-colors">← Dashboard</Link>
          <span>/</span><span>Registro</span><span>/</span><span>Usuarios</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">👤 Gestión de Usuarios</h1>
        <p className="text-gray-500 text-sm mt-1">Alta, baja y modificación de usuarios del sistema</p>
      </div>

      {/* Tabla */}
      <CrudTable
        items={usuarios}
        columns={columnas}
        keyField="user_id"
        onNew={abrirNuevo}
        newLabel="+ Nuevo Usuario"
        loading={loading}
        emptyText="No hay usuarios registrados"
        searchPlaceholder="Buscar por nombre, email o rol…"
        getSearchText={(u) => `${u.full_name} ${u.email} ${u.role?.role_name ?? ''}`}
      />

      {/* ── Modal Crear / Editar ───────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}
        maxWidth="max-w-md"
        footer={
          <>
            <button onClick={() => setModalOpen(false)}
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
        <div className="space-y-4">
          {/* Email (solo en creación) */}
          {!editando && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input type="email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="usuario@empresa.com"
                className={`w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none
                  ${errores.email ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              />
              {errores.email && <p className="text-red-500 text-xs mt-1">{errores.email}</p>}
            </div>
          )}

          {/* Email readonly en edición */}
          {editando && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} readOnly
                className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-2 text-sm text-gray-500 cursor-not-allowed" />
            </div>
          )}

          {/* Nombre completo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Juan Pérez"
              className={`w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none
                ${errores.full_name ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
            />
            {errores.full_name && <p className="text-red-500 text-xs mt-1">{errores.full_name}</p>}
          </div>

          {/* Rol */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol <span className="text-red-500">*</span>
            </label>
            <select value={form.role_id}
              onChange={(e) => setForm((f) => ({ ...f, role_id: Number(e.target.value) }))}
              className={`w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none
                ${errores.role_id ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
            >
              <option value="">— Seleccioná un rol —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.role_name}</option>
              ))}
            </select>
            {errores.role_id && <p className="text-red-500 text-xs mt-1">{errores.role_id}</p>}
          </div>

          {/* Contraseña (solo creación) */}
          {!editando && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input type="password" value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 8 caracteres"
                  className={`flex-1 border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none
                    ${errores.password ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                />
                <button type="button"
                  onClick={() => setForm((f) => ({ ...f, password: generarPassword() }))}
                  className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm transition-colors"
                  title="Generar contraseña aleatoria"
                >
                  🎲
                </button>
              </div>
              {errores.password && <p className="text-red-500 text-xs mt-1">{errores.password}</p>}
              {form.password && (
                <p className="text-emerald-600 text-xs mt-1 font-mono bg-emerald-50 px-2 py-1 rounded-lg">
                  Contraseña: {form.password}
                </p>
              )}
            </div>
          )}

          {/* Estado (solo edición) */}
          {editando && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="u_is_active" checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <label htmlFor="u_is_active" className="text-sm font-medium text-gray-700">
                Usuario activo
              </label>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal Reset Contraseña ─────────────────────────────────────── */}
      <Modal
        open={resetModal}
        onClose={() => setResetModal(false)}
        title="🔑 Resetear Contraseña"
        maxWidth="max-w-sm"
        headerClass="bg-gradient-to-r from-amber-500 to-amber-600"
        footer={
          <>
            <button onClick={() => setResetModal(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={confirmarReset} disabled={reseteando}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold transition-colors">
              {reseteando ? '⏳ Reseteando…' : 'Confirmar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Ingresá la nueva contraseña para el usuario.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <div className="flex gap-2">
              <input
                type={passVisible ? 'text' : 'password'}
                value={nuevaPass}
                onChange={(e) => setNuevaPass(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:outline-none"
              />
              <button type="button" onClick={() => setPassVisible((v) => !v)}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm transition-colors">
                {passVisible ? '🙈' : '👁️'}
              </button>
              <button type="button"
                onClick={() => { const p = generarPassword(); setNuevaPass(p); setPassVisible(true) }}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm transition-colors"
                title="Generar contraseña">
                🎲
              </button>
            </div>
            {nuevaPass.length > 0 && nuevaPass.length < 8 && (
              <p className="text-red-500 text-xs mt-1">Mínimo 8 caracteres</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

