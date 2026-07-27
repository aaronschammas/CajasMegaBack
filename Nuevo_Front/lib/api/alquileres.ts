// ─── Capa de servicios: Alquileres ───────────────────────────────────────────

import {
  Propiedad, ResumenKPIs, ResumenMovimientos, ActualizacionPendiente,
} from '@/types/alquiler'
import { apiRequest } from './client'

async function apiFetch<T>(method: string, url: string, body?: object): Promise<T> {
  return apiRequest<T>(url, {
    method,
    body,
  })
}

// ── Propiedades ───────────────────────────────────────────────────────────────
export async function getPropiedades(anio?: number): Promise<{ propiedades: Propiedad[] }> {
  const qs = anio ? `?anio=${anio}` : ''
  return apiFetch('GET', `/api/alquileres/propiedades${qs}`)
}

export async function getPropiedad(id: string): Promise<Propiedad> {
  return apiFetch('GET', `/api/alquileres/propiedades/${id}`)
}

export async function createPropiedad(data: Partial<Propiedad>): Promise<{ propiedad: Propiedad }> {
  return apiFetch('POST', '/api/alquileres/propiedades', data)
}

export async function updatePropiedad(id: string, data: Partial<Propiedad>): Promise<{ propiedad: Propiedad }> {
  return apiFetch('PUT', `/api/alquileres/propiedades/${id}`, data)
}

export async function deletePropiedad(id: string): Promise<void> {
  return apiFetch('DELETE', `/api/alquileres/propiedades/${id}`)
}

// ── Pagos ─────────────────────────────────────────────────────────────────────
export async function registrarPago(
  propId: string, mes: number, monto: number
): Promise<{ propiedad: Propiedad }> {
  return apiFetch('POST', `/api/alquileres/propiedades/${propId}/pago`, { mes, monto })
}

export async function deshacerPago(
  propId: string, mes: number
): Promise<{ propiedad: Propiedad }> {
  return apiFetch('DELETE', `/api/alquileres/propiedades/${propId}/pago/${mes}`)
}

// ── Resúmenes ─────────────────────────────────────────────────────────────────
export async function getResumenKPIs(anio?: number): Promise<ResumenKPIs> {
  const qs = anio ? `?anio=${anio}` : ''
  return apiFetch('GET', `/api/alquileres/resumen${qs}`)
}

export async function getResumenMovimientos(
  periodo: 'dia' | 'mes' | 'anio'
): Promise<ResumenMovimientos> {
  return apiFetch('GET', `/api/alquileres/resumen/movimientos?periodo=${periodo}`)
}

// ── Actualizaciones pendientes (INDEC) ────────────────────────────────────────
export async function getActualizacionesPendientes(): Promise<{ pendientes: ActualizacionPendiente[] }> {
  return apiFetch('GET', '/api/alquileres/actualizaciones-pendientes')
}

export async function confirmarActualizacion(
  propId: string, nuevoMonto: number, notas?: string
): Promise<void> {
  return apiFetch('PUT', `/api/alquileres/propiedades/${propId}/actualizar-monto`, {
    nuevo_monto: nuevoMonto,
    notas,
  })
}

export async function posponerActualizacion(
  propId: string, posponerHasta: string
): Promise<void> {
  return apiFetch('POST', `/api/alquileres/propiedades/${propId}/posponer`, {
    posponer_hasta: posponerHasta,
  })
}

// ── Metadata ──────────────────────────────────────────────────────────────────
export async function deleteMetadataCampo(
  propId: string, campo: string
): Promise<{ propiedad: Propiedad }> {
  return apiFetch('DELETE', `/api/alquileres/propiedades/${propId}/metadata/${campo}`)
}
