'use client'

// ─── Header de la aplicación ──────────────────────────────────────────────────
// Equivale al <header> de movimiento.html con nav y logout.

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store/appStore'
import { useRBAC } from '@/lib/hooks/useRBAC'
import { logout } from '@/lib/api/auth'
import { useNotification } from '@/components/ui/Notification'

const NAV_ITEMS = [
  { href: '/movimientos',          label: 'Inicio',         icon: '🏠', permission: null },
  { href: '/reporte',              label: 'Resumen Diario', icon: '📊', permission: 'admin:reports:own' },
  { href: '/reporte-general',      label: 'Reporte Global', icon: '📈', permission: 'admin:reports:all' },
  { href: '/registro/conceptos',   label: 'Conceptos',      icon: '🏷️', permission: 'admin:concepts' },
  { href: '/registro/usuarios',    label: 'Usuarios',       icon: '👤', permission: 'admin:users' },
  { href: '/registro/roles',       label: 'Roles',          icon: '👥', permission: 'admin:roles' },
  { href: '/alquileres',           label: 'Alquileres',     icon: '🏢', permission: 'view_alquileres' },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAppStore()
  const { can } = useRBAC()
  const { show } = useNotification()

  const handleLogout = async () => {
    if (!confirm('¿Cerrar sesión?')) return
    try {
      const data = await logout()
      if (data.success) {
        show('Sesión cerrada', 'success')
        setTimeout(() => router.push(data.redirect_to ?? '/login'), 400)
      }
    } catch {
      show('Error al cerrar sesión', 'error')
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 font-bold text-blue-600 text-lg shrink-0">
          <span className="text-2xl">🏧</span>
          <span className="hidden sm:inline">MegaAdmin</span>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
          {NAV_ITEMS.filter(item => item.permission === null || can(item.permission)).map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${pathname === item.href
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
            >
              <span>{item.icon}</span>
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Usuario + Logout */}
        <div className="flex items-center gap-3 shrink-0">
          {user && (
            <span className="hidden lg:block text-sm text-gray-500 max-w-[120px] truncate">
              {user.full_name}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <span>🚪</span>
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  )
}
