'use client'

// ─── Página: Gestión de Roles ─────────────────────────────────────────────────
//
// IMPORTANTE: En este backend los permisos están hardcoded en middleware/rbac.go
// por nombre de rol. La tabla `roles` solo tiene role_id y role_name.
// Se muestran los permisos como referencia visual (solo lectura desde el RBAC),
// pero el backend no los guarda en la DB.

import { useState, useEffect, useCallback } from 'react'
import { CrudTable, Column } from '@/components/admin/CrudTable'
import { Modal }   from '@/components/ui/Modal'
import { Badge }   from '@/components/ui/Badge'
import { useNotification } from '@/components/ui/Notification'
import { getRoles, createRol, updateRol, deleteRol, Rol } from '@/lib/api/roles'
import { getUsuarios, Usuario } from '@/lib/api/usuarios'
import Link from 'next/link'

// Mapa hardcoded de permisos por nombre de rol (refleja rbac.go)
const PERMISOS_POR_ROL: Record<string, string[]> = {
  'Usuario': ['movement:create', 'movement:read:own', 'arco:open:own', 'arco:close', 'arco:read'],
  'Supervisor': ['movement:create', 'movement:read:own', 'movement:update', 'movement:delete',
                 'arco:open:own', 'arco:close', 'arco:read', 'admin:concepts', 'admin:reports:own'],
  'Administrador General': ['Todos los permisos del sistema'],
  'Gestor de Alquileres': ['alquileres:view', 'alquileres:manage', 'alquileres:pago:registrar'],
}

export default function RolesPage() {
  const { show } = useNotification()

  const [roles,    setRoles]    = useState<Rol[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading,  setLoading]  = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editando,  setEditando]  = useState<Rol | null>(null)
  const [roleName,  setRoleName]  = useState('')
  const [errNombre, setErrNombre] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [r, u] = await Promise.all([getRoles(), getUsuarios()])
      setRoles(r)
      setUsuarios(u)
    } catch (err: any) {
      show(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setRoleName('')
    setErrNombre('')
    setModalOpen(true)
  }

  const abrirEditar = (r: Rol) => {
    setEditando(r)
    setRoleName(r.role_name)
    setErrNombre('')
    setModalOpen(true)
  }

  const guardar = async () => {
    if (!roleName.trim()) { setErrNombre('El nombre es requerido'); return }
    setGuardando(true)
    try {
      if (editando) {
        await updateRol(editando.id, { role_name: roleName })
        show('✅ Rol actualizado', 'success')
      } else {
        await createRol({ role_name: roleName })
        show('✅ Rol creado', 'success')
      }
      setModalOpen(false)
      cargar()
    } catch (err: any) {
      show(err.message, 'error')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (r: Rol) => {
    const count = usuarios.filter((u) => u.role_id === r.id).length
    if (count > 0) {
      show(`No se puede eliminar: ${count} usuario(s) tienen este rol`, 'warning'); return
    }
    if (!confirm(`¿Eliminar el rol "${r.role_name}"?`)) return
    try {
      await deleteRol(r.id)
      show('Rol eliminado', 'success')
      cargar()
    } catch (err: any) { show(err.message, 'error') }
  }

  const columnas: Column<Rol>[] = [
    {
      key: 'id',
      header: '#',
      render: (r) => <span className="text-gray-400 text-xs">{r.id}</span>,
    },
    {
      key: 'role_name',
      header: 'Nombre del Rol',
      render: (r) => (
        <span className="font-bold text-gray-800 flex items-center gap-2">🛡️ {r.role_name}</span>
      ),
    },
    {
      key: 'permisos',
      header: 'Permisos (RBAC)',
      render: (r) => {
        const perms = PERMISOS_POR_ROL[r.role_name] ?? []
        if (perms.length === 0)
          return <span className="text-gray-400 text-xs italic">Rol personalizado</span>
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {perms.slice(0, 3).map((p) => (
              <span key={p} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{p}</span>
            ))}
            {perms.length > 3 && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">+{perms.length - 3}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'usuarios',
      header: 'Usuarios',
      render: (r) => {
        const count = usuarios.filter((u) => u.role_id === r.id).length
        return <Badge variant={count > 0 ? 'info' : 'gray'}>👥 {count}</Badge>
      },
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (r) => (
        <div className="flex gap-1.5">
          <button onClick={() => abrirEditar(r)}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors" title="Editar">✏️</button>
          <button onClick={() => eliminar(r)}
            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors" title="Eliminar">🗑️</button>
        </div>
      ),
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/movimientos" className="hover:text-blue-500 transition-colors">← Dashboard</Link>
          <span>/</span><span>Registro</span><span>/</span><span>Roles</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">🛡️ Gestión de Roles</h1>
        <p className="text-gray-500 text-sm mt-1">Los permisos están definidos por rol en el servidor (RBAC).</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
        <span className="text-base mt-0.5">ℹ️</span>
        <span>
          Los permisos mostrados son informativos — están hardcoded en el backend según el nombre del rol.
          Al crear o editar un rol, asegurate de que el nombre coincida exactamente con alguno de los roles del RBAC:
          <strong> Usuario, Supervisor, Administrador General, Gestor de Alquileres</strong>.
        </span>
      </div>

      <CrudTable
        items={roles}
        columns={columnas}
        keyField="id"
        onNew={abrirNuevo}
        newLabel="+ Nuevo Rol"
        loading={loading}
        emptyText="No hay roles registrados"
        searchPlaceholder="Buscar por nombre…"
        getSearchText={(r) => r.role_name}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Rol' : '➕ Nuevo Rol'}
        maxWidth="max-w-sm"
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del rol <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="Ej: Supervisor, Cajero…"
            list="roles-sugeridos"
            className={`w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none
              ${errNombre ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
          />
          <datalist id="roles-sugeridos">
            <option value="Usuario" />
            <option value="Supervisor" />
            <option value="Administrador General" />
            <option value="Gestor de Alquileres" />
          </datalist>
          {errNombre && <p className="text-red-500 text-xs mt-1">{errNombre}</p>}
        </div>
      </Modal>
    </div>
  )
}
