// ─── Capa de servicios: Movimientos ──────────────────────────────────────────
//
// NOTAS SOBRE EL BACKEND:
//  - GET  /api/movimientos/arco/:id  → { movements: [...] }
//  - DELETE /api/movimientos/:id     → { message: "..." }
//  - POST /ingresos                  → acepta JSON { movements:[...] } o
//                                       multipart con campo "movimientos" (JSON string)
//  - NO existe POST /egresos — ambos tipos (Ingreso y Egreso) van a POST /ingresos
//    El tipo se determina por el campo movement_type en cada movimiento.

import { Movimiento, MovimientoPendiente } from '@/types/movimiento'
import { apiRequest } from './client'

export async function getMovimientosArco(
  arcoId: number
): Promise<{ movements: Movimiento[] }> {
  return apiRequest(`/api/movimientos/arco/${arcoId}`)
}

export async function getMovimientosGlobal(): Promise<{ movements: Movimiento[] }> {
  return apiRequest('/api/movimientos/global')
}

export async function deleteMovimiento(id: number): Promise<void> {
  await apiRequest(`/api/movimientos/${id}`, { method: 'DELETE' })
}

export async function enviarPila(
  _tipo: 'Ingreso' | 'Egreso',   // ignorado: el tipo va dentro de cada movimiento
  pila: MovimientoPendiente[]
): Promise<void> {
  // El backend soporta JSON directo: { movements: [...] }
  // Ambos tipos (Ingreso y Egreso) usan el mismo endpoint POST /ingresos
  await apiRequest('/ingresos', { method: 'POST', body: { movements: pila } })
}
