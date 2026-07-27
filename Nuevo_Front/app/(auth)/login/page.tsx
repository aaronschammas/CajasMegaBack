'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/api/auth'
import { AppIcon } from '@/components/ui/AppIcon'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      if (data.success) {
        router.push(data.redirect_to ?? '/movimientos')
      } else {
        setError(data.error ?? 'Credenciales incorrectas')
      }
    } catch {
      setError('Error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mb-4 inline-grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-sm">
            <AppIcon name="wallet" className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">MegaAdmin</h1>
          <p className="mt-1 text-blue-100">Sistema de Gestión de Caja</p>
        </div>

        <section className="rounded-2xl border border-white/30 bg-white p-6 shadow-2xl sm:p-8" aria-labelledby="login-title">
          <div className="mb-6">
            <h2 id="login-title" className="text-2xl font-extrabold text-slate-900">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-slate-500">Ingresá con tu cuenta para continuar.</p>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              <AppIcon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="control-label">Email</label>
              <input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="usuario@empresa.com" className="control-input" />
            </div>

            <div>
              <label htmlFor="login-password" className="control-label">Contraseña</label>
              <input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="••••••••" className="control-input" />
            </div>

            <button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 font-bold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
              <AppIcon name="lock" className="h-5 w-5" />
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </section>

        <p className="mt-6 text-center text-xs text-blue-100/80">© {new Date().getFullYear()} MegaAdmin — Todos los derechos reservados</p>
      </div>
    </main>
  )
}
