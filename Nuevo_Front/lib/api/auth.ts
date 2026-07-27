// ─── Capa de servicios: Autenticación ────────────────────────────────────────
//
// NOTAS SOBRE EL BACKEND:
//  - POST /api/login       espera application/x-www-form-urlencoded (no JSON)
//  - GET  /api/me          retorna { user: { user_id, full_name, email, role:{...} },
//                                    permissions: string[], role: string }
//  - POST /logout          retorna { success, redirect_to }
//  - Cookies: 'session_token' (principal) + 'jwt' (alias), ambas HttpOnly

import { User } from '@/types/user'
import { apiRequest, formBody } from './client'

// ── Normaliza la respuesta anidada de /api/me al tipo User plano ──────────────
function normalizarUser(data: any): User {
  const u = data.user ?? data
  return {
    user_id:     u.user_id   ?? u.UserID ?? u.id,
    full_name:   u.full_name ?? u.FullName ?? u.name ?? '',
    email:       u.email     ?? u.Email ?? '',
    role:        data.role   ?? u.role?.role_name ?? u.role ?? '',
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  }
}

export async function getMe(): Promise<User> {
  const data = await apiRequest('/api/me')
  return normalizarUser(data)
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; redirect_to?: string; error?: string }> {
  // El backend lee ctx.PostForm("email") / ctx.PostForm("password")
  // → DEBE enviarse como application/x-www-form-urlencoded
  const body = formBody({ email, password })

  try {
    return await apiRequest('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (err: any) {
    return {
      success: false,
      error: err.message ?? 'Credenciales incorrectas',
    }
  }
}

export async function logout(): Promise<{ success: boolean; redirect_to?: string }> {
  return apiRequest<{ success: boolean; redirect_to?: string }>('/logout', { method: 'POST' })
    .catch(() => ({ success: true }))
}
