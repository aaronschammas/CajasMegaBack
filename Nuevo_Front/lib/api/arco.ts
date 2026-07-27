import { ArcoEstado, SaldoArco } from '@/types/arco'
import { apiRequest, formBody } from './client'

export class ArcoConflictError extends Error {
  arco: any

  constructor(arco: any, msg: string) {
    super(msg)
    this.name = 'ArcoConflictError'
    this.arco = arco
  }
}

export async function getArcoEstado(isGlobal = false): Promise<ArcoEstado> {
  const qs = isGlobal ? '?is_global=true' : ''
  try {
    return await apiRequest<ArcoEstado>(`/api/arco-estado${qs}`)
  } catch {
    return { arco_abierto: false }
  }
}

export async function getSaldoArco(isGlobal = false): Promise<SaldoArco> {
  const qs = isGlobal ? '?is_global=true' : ''
  try {
    return await apiRequest<SaldoArco>(`/api/saldo-ultimo-arco${qs}`)
  } catch {
    return {
      arqueo_id: 0,
      owner_id: 0,
      is_global: isGlobal,
      turno: 'M',
      activo: false,
      saldo_inicial: 0,
      total_ingresos: 0,
      total_egresos: 0,
      total_retiros: 0,
      saldo_total: 0,
    }
  }
}

export async function abrirArco(
  turno: 'M' | 'T',
  forzarNuevo = false,
  isGlobal = false
): Promise<any> {
  const body = formBody({ turno })
  if (forzarNuevo) body.set('forzar_nuevo', 'true')
  if (isGlobal) body.set('is_global', 'true')

  const res = await fetch('/arco/abrir-avanzado', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'include',
    body: body.toString(),
  })

  const data = await res.json().catch(() => ({}))
  if (res.status === 409) {
    throw new ArcoConflictError(data.arco, data.msg || 'Ya hay una caja abierta')
  }
  if (!res.ok) throw new Error(data.error || 'Error al abrir el arqueo')

  return data
}

export async function cerrarArco(params: {
  arcoId: number
  totalContado: number
  retiroAmount: number
  isGlobal?: boolean
}): Promise<{ arco: any; diferencia: number; total_contado: number }> {
  const body = formBody({
    arco_id: params.arcoId,
    retiro_amount: params.retiroAmount,
    total_contado: params.totalContado,
  })
  if (params.isGlobal) body.set('is_global', 'true')

  return apiRequest('/arco/cerrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}
