'use client'

// ─── Layout protegido del dashboard ──────────────────────────────────────────
// Carga el usuario al montar e inicializa el store global.
// Envuelve todas las páginas de /(dashboard)/.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { useAppStore } from '@/lib/store/appStore'
import { useArco } from '@/lib/hooks/useArco'
import { getMe } from '@/lib/api/auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { setUser } = useAppStore()
  const { recargar } = useArco()

  useEffect(() => {
    getMe()
      .then((user) => {
        setUser(user)
        recargar()
      })
      .catch(() => router.replace('/login'))
  // Solo al montar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
