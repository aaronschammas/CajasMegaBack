// ─── Constantes y helpers compartidos del módulo Alquileres ─────────────────

import { EstadoPago, Propiedad, FiltroEstado } from '@/types/alquiler'

export const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
export const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0)

export const fmtCorto = (n: number): string => {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(0) + 'k'
  return fmt(n)
}

export const fmtUSD = (n: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)

export const ESTADO_ICONO: Record<EstadoPago, string> = {
  paid:    '✓',
  pending: '–',
  late_1:  '!',
  late_2:  '!!',
}

export const ESTADO_LABEL: Record<EstadoPago, string> = {
  paid:    'Pagado',
  pending: 'Pendiente',
  late_1:  'Atrasado (1 mes)',
  late_2:  'Atrasado (2+ meses)',
}

export const ESTADO_CLASSES: Record<EstadoPago, string> = {
  paid:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-gray-100 text-gray-500 border-gray-200',
  late_1:  'bg-red-100 text-red-600 border-red-200',
  late_2:  'bg-red-900/20 text-red-800 border-red-400',
}

// Determina si una propiedad match un filtro rápido
export function matchFiltro(prop: Propiedad, filtro: FiltroEstado): boolean {
  if (!filtro) return true
  const pagos = prop.pagos || []
  const tieneAtraso1 = pagos.some(p => p.estado === 'late_1' || p.estado === 'late_2')
  const tieneAtraso2 = pagos.some(p => p.estado === 'late_2')
  const mesesPend    = pagos.filter(p => p.estado !== 'paid').length

  if (filtro === 'aldia')       return mesesPend === 0 && prop.ocupada
  if (filtro === 'atraso1')     return tieneAtraso1
  if (filtro === 'atraso2')     return tieneAtraso2
  if (filtro === 'desocupadas') return !prop.ocupada
  return true
}

// Convierte archivo a base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload  = (e) => res(e.target?.result as string)
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}
