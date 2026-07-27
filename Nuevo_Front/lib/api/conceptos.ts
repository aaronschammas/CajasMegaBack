// ─── Capa de servicios: Conceptos ────────────────────────────────────────────
// Ruta real del backend: /api/admin/conceptos  (NO /api/conceptos)

import { Concepto } from '@/types/concepto'
import { apiRequest } from './client'

// El backend usa concept_id, concept_name, movement_type_association, is_active
// Mapeamos a nuestro tipo Concepto { id, concept_name, concept_type, is_active }
function mapConcepto(c: any): Concepto {
  return {
    id:           c.concept_id ?? c.id,
    concept_name: c.concept_name,
    concept_type: c.movement_type_association ?? c.concept_type ?? 'Ambos',
    description:  c.description,
    is_active:    c.is_active ?? true,
  }
}

export async function getConceptos(): Promise<Concepto[]> {
  const data = await apiRequest<any>('/api/admin/conceptos')
  // El backend puede retornar array directo o { conceptos: [...] }
  const arr = Array.isArray(data) ? data : (data.conceptos ?? [])
  return arr.map(mapConcepto)
}

export async function getConceptosPorTipo(
  tipo: 'Ingreso' | 'Egreso'
): Promise<Concepto[]> {
  const todos = await getConceptos()
  return todos.filter(
    (c) => c.is_active && (c.concept_type === tipo || c.concept_type === 'Ambos')
  )
}

export async function createConcepto(data: Partial<Concepto>): Promise<Concepto> {
  // El backend espera: concept_name, movement_type_association
  const payload = {
    concept_name:              data.concept_name,
    movement_type_association: data.concept_type,
    description:               data.description,
  }
  const json = await apiRequest<any>('/api/admin/conceptos', { method: 'POST', body: payload })
  return mapConcepto(json.concepto ?? json)
}

export async function updateConcepto(id: number, data: Partial<Concepto>): Promise<Concepto> {
  const payload: any = {}
  if (data.concept_name !== undefined) payload.concept_name = data.concept_name
  if (data.concept_type !== undefined) payload.movement_type_association = data.concept_type
  if (data.description  !== undefined) payload.description = data.description
  if (data.is_active    !== undefined) payload.is_active   = data.is_active

  const json = await apiRequest<any>(`/api/admin/conceptos/${id}`, { method: 'PUT', body: payload })
  return mapConcepto(json.concepto ?? json)
}

export async function deleteConcepto(id: number): Promise<void> {
  await apiRequest(`/api/admin/conceptos/${id}`, { method: 'DELETE' })
}
