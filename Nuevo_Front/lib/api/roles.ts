// ─── Capa de servicios: Roles ─────────────────────────────────────────────────
// Ruta real del backend: /api/admin/roles  (NO /api/roles)

import { apiRequest } from './client'

export interface Rol {
  id:          number
  role_name:   string
  permissions: string[]
}

function mapRol(r: any): Rol {
  return {
    id:          r.role_id   ?? r.id,
    role_name:   r.role_name ?? r.RoleName ?? '',
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
  }
}

export async function getRoles(): Promise<Rol[]> {
  const data = await apiRequest<any>('/api/admin/roles')
  const arr = Array.isArray(data) ? data : (data.roles ?? [])
  return arr.map(mapRol)
}

export async function createRol(data: Partial<Rol>): Promise<Rol> {
  const json = await apiRequest<any>('/api/admin/roles', {
    method: 'POST',
    body: { role_name: data.role_name, permissions: data.permissions },
  })
  return mapRol(json.rol ?? json.role ?? json)
}

export async function updateRol(id: number, data: Partial<Rol>): Promise<Rol> {
  const json = await apiRequest<any>(`/api/admin/roles/${id}`, {
    method: 'PUT',
    body: { role_name: data.role_name, permissions: data.permissions },
  })
  return mapRol(json.rol ?? json.role ?? json)
}

export async function deleteRol(id: number): Promise<void> {
  await apiRequest(`/api/admin/roles/${id}`, { method: 'DELETE' })
}
