// ─── Hook: RBAC (permisos del usuario) ───────────────────────────────────────

import { useAppStore } from '@/lib/store/appStore'

export function useRBAC() {
  const { permissions, role } = useAppStore()

  return {
    permissions,
    role,
    hasPermission: (perm: string) => permissions.includes(perm),
    hasAnyPermission: (perms: string[]) => perms.some((p) => permissions.includes(p)),
    isAdmin: () => role === 'Administrador General',
    isSupervisor: () => role === 'Supervisor',
    isUser: () => role === 'Usuario',
    can: (perm: string) => permissions.includes(perm),
  }
}
