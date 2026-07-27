import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MegaAdmin — Control de Caja',
  description: 'Sistema de gestión de caja MegaAdmin',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
        />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
