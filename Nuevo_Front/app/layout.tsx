import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MegaAdmin — Control de Caja',
  description: 'Sistema de gestión de caja MegaAdmin',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  )
}
