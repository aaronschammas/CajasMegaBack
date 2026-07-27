'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store/appStore'
import { logout } from '@/lib/api/auth'
import { useNotification } from '@/components/ui/Notification'
import { AppIcon, AppIconName } from '@/components/ui/AppIcon'

interface NavItem {
  href: string
  label: string
  icon: AppIconName
  permissions?: string[]
}

const OPERACIONES: NavItem[] = [
  { href: '/movimientos', label: 'Inicio', icon: 'home' },
  { href: '/ingresos', label: 'Registrar ingreso', icon: 'income', permissions: ['movement:create'] },
  { href: '/egresos', label: 'Registrar egreso', icon: 'expense', permissions: ['movement:create'] },
  { href: '/historial', label: 'Movimientos', icon: 'history', permissions: ['movement:read', 'movement:read:own', 'movement:read:all'] },
  { href: '/reporte', label: 'Resumen diario', icon: 'report', permissions: ['admin:reports', 'admin:reports:own'] },
  { href: '/reporte-general', label: 'Reporte global', icon: 'chart', permissions: ['arco:view:global', 'admin:reports:all'] },
  { href: '/alquileres', label: 'Alquileres', icon: 'building', permissions: ['alquileres:view'] },
]

const ADMINISTRACION: NavItem[] = [
  { href: '/registro/conceptos', label: 'Conceptos', icon: 'tag', permissions: ['admin:concepts'] },
  { href: '/registro/usuarios', label: 'Usuarios', icon: 'users', permissions: ['admin:users'] },
  { href: '/registro/roles', label: 'Roles', icon: 'roles', permissions: ['admin:roles'] },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, permissions, clearUser } = useAppStore()
  const { show } = useNotification()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const visible = (item: NavItem) =>
    !item.permissions || item.permissions.some((permission) => permissions.includes(permission))

  const handleLogout = async () => {
    if (!confirm('¿Cerrar sesión?')) return
    setLoggingOut(true)
    try {
      const data = await logout()
      clearUser()
      show('Sesión cerrada', 'success')
      router.push(data.redirect_to ?? '/login')
    } catch {
      show('No se pudo cerrar la sesión', 'error')
      setLoggingOut(false)
    }
  }

  const NavGroup = ({ title, items }: { title: string; items: NavItem[] }) => {
    const filtered = items.filter(visible)
    if (filtered.length === 0) return null
    return (
      <div className="mb-5">
        <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</p>
        <nav className="space-y-1" aria-label={title}>
          {filtered.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`group flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <AppIcon name={item.icon} className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    )
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Link href="/movimientos" className="flex items-center gap-3" aria-label="MegaAdmin, inicio">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 font-bold text-white shadow-sm">M</span>
          <span>
            <span className="block text-base font-bold leading-tight text-slate-900">MegaAdmin</span>
            <span className="block text-xs text-slate-500">Control diario</span>
          </span>
        </Link>
        <button type="button" onClick={() => setOpen((value) => !value)} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-700" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open}>
          <AppIcon name={open ? 'close' : 'menu'} />
        </button>
      </header>

      {open && <button type="button" className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú" />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`} aria-label="Menú principal">
        <div className="flex h-[88px] items-center justify-between border-b border-slate-200 px-5">
          <Link href="/movimientos" className="flex items-center gap-3" aria-label="MegaAdmin, inicio">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-sm">M</span>
            <span>
              <span className="block text-lg font-bold leading-tight text-slate-900">MegaAdmin</span>
              <span className="block text-xs text-slate-500">Control diario</span>
            </span>
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Cerrar menú">
            <AppIcon name="close" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <NavGroup title="Operaciones" items={OPERACIONES} />
          <NavGroup title="Administración" items={ADMINISTRACION} />
        </div>

        <div className="border-t border-slate-200 p-4">
          {user && (
            <div className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">{(user.full_name || user.email || 'U').charAt(0).toUpperCase()}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-800">{user.full_name}</span>
                <span className="block truncate text-xs text-slate-500">{user.email}</span>
              </span>
            </div>
          )}
          <button type="button" onClick={handleLogout} disabled={loggingOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
            <AppIcon name="logout" className="h-5 w-5" />
            {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
    </>
  )
}
