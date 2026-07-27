import { redirect } from 'next/navigation'

// La raíz redirige al dashboard o al login según el middleware
export default function RootPage() {
  redirect('/movimientos')
}
