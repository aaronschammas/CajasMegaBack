// ─── Capa de servicios: Usuarios ─────────────────────────────────────────────
// Ruta real del backend: /api/admin/usuarios  (NO /api/usuarios)

import { apiRequest } from './client'

export interface Usuario {
  user_id:   number
  full_name: string
  email:     string
  role_id:   number
  role?:     { id: number; role_name: string }
  is_active: boolean
}

function mapUsuario(u: any): Usuario {
  return {
    user_id:   u.user_id   ?? u.UserID  ?? u.id,
    full_name: u.full_name ?? u.FullName ?? '',
    email:     u.email     ?? u.Email   ?? '',
    role_id:   u.role_id   ?? u.RoleID  ?? u.role?.id ?? 0,
    role:      u.role
      ? { id: u.role.role_id ?? u.role.id ?? u.role_id, role_name: u.role.role_name ?? u.role.RoleName ?? '' }
      : undefined,
    is_active: u.is_active ?? u.IsActive ?? true,
  }
}

export async function getUsuarios(): Promise<Usuario[]> {
  const data = await apiRequest<any>('/api/admin/usuarios')
  const arr = Array.isArray(data) ? data : (data.usuarios ?? [])
  return arr.map(mapUsuario)
}

export async function createUsuario(
  data: Partial<Usuario> & { password?: string }
): Promise<Usuario> {
  const json = await apiRequest<any>('/api/admin/usuarios', { method: 'POST', body: data })
  return mapUsuario(json.usuario ?? json)
}

export async function updateUsuario(
  id: number,
  data: Partial<Usuario> & { password?: string }
): Promise<Usuario> {
  const json = await apiRequest<any>(`/api/admin/usuarios/${id}`, { method: 'PUT', body: data })
  return mapUsuario(json.usuario ?? json)
}

export async function deleteUsuario(id: number): Promise<void> {
  await apiRequest(`/api/admin/usuarios/${id}`, { method: 'DELETE' })
}
