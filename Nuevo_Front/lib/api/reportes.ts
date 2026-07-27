// ─── Capa de servicios: Reportes e Historial ─────────────────────────────────
//
// IMPORTANTE: Los endpoints /reporte y /reporte_general del backend retornan
// HTML (Go templates), NO JSON. Por eso los reportes del frontend los construimos
// a partir de las APIs JSON existentes:
//
//   Reporte personal:  /api/arco-estado + /api/saldo-ultimo-arco + /api/movimientos/arco/:id
//   Reporte general:   igual pero con ?is_global=true
//   Historial:         /api/movimientos + paginación propia del store
//
// Para historial no existe un endpoint JSON de arcos paginados; usamos
// /api/movimientos/arco/:id con los arcos conocidos del store, o consultamos
// directamente los movimientos del arco activo y los cerrados que retorne el backend.

import { Arco, SaldoArco } from '@/types/arco'
import { Movimiento } from '@/types/movimiento'
import { getArcoEstado, getSaldoArco } from './arco'
import { getMovimientosArco } from './movimientos'

// ─── Tipo unificado de reporte ────────────────────────────────────────────────
export interface ReporteArco {
  arco: Arco & {
    total_ingresos: number
    total_egresos:  number
    total_retiros:  number
    saldo_final:    number
    usuario?: { full_name: string; user_id?: number }
  }
  movements: Movimiento[]
  saldo:     SaldoArco
}

// ─── Reporte personal del usuario logueado ────────────────────────────────────
export async function getReporte(): Promise<ReporteArco> {
  const [estadoData, saldoData] = await Promise.all([
    getArcoEstado(false),
    getSaldoArco(false),
  ])

  if (!estadoData.arco) {
    throw new Error('No hay arqueo activo para generar el reporte')
  }

  const movements = await getMovimientosArco(estadoData.arco.id)
    .then((d) => d.movements)
    .catch(() => [] as Movimiento[])

  return {
    arco: {
      ...estadoData.arco,
      total_ingresos: saldoData.total_ingresos,
      total_egresos:  saldoData.total_egresos,
      total_retiros:  saldoData.total_retiros,
      saldo_final:    saldoData.saldo_total,
    },
    movements,
    saldo: saldoData,
  }
}

// ─── Reporte global (Admin General) ──────────────────────────────────────────
export async function getReporteGeneral(): Promise<ReporteArco[]> {
  // Obtiene el estado global consolidado
  const [estadoGlobal, saldoGlobal, estadoPersonal] = await Promise.all([
    getArcoEstado(true),
    getSaldoArco(true),
    getArcoEstado(false),
  ])

  const resultados: ReporteArco[] = []

  // Arco personal del admin (si está abierto)
  if (estadoPersonal.arco) {
    const saldoPersonal = await getSaldoArco(false).catch(() => null)
    const movs = await getMovimientosArco(estadoPersonal.arco.id)
      .then((d) => d.movements)
      .catch(() => [] as Movimiento[])

    resultados.push({
      arco: {
        ...estadoPersonal.arco,
        total_ingresos: saldoPersonal?.total_ingresos ?? 0,
        total_egresos:  saldoPersonal?.total_egresos  ?? 0,
        total_retiros:  saldoPersonal?.total_retiros  ?? 0,
        saldo_final:    saldoPersonal?.saldo_total    ?? 0,
      },
      movements: movs,
      saldo:     saldoPersonal ?? saldoGlobal,
    })
  }

  // Si no hay nada, retorna el global como único elemento
  if (resultados.length === 0) {
    resultados.push({
      arco: {
        id: 0, created_by: 0, owner_id: 0, is_global: true,
        fecha_apertura: new Date().toISOString(),
        turno: 'M', activo: true, saldo_inicial: saldoGlobal.saldo_inicial,
        saldo_final:    saldoGlobal.saldo_total,
        total_ingresos: saldoGlobal.total_ingresos,
        total_egresos:  saldoGlobal.total_egresos,
        total_retiros:  saldoGlobal.total_retiros,
        usuario: { user_id: 0, full_name: 'Global (todos los usuarios)', email: '' },
      },
      movements: [],
      saldo:     saldoGlobal,
    })
  }

  return resultados
}

// ─── Historial ────────────────────────────────────────────────────────────────
// No existe un endpoint JSON de historial paginado en el backend.
// Construimos el historial a partir de los arcos cuyos IDs conocemos.
// Esta función hace lo mejor posible con los datos disponibles.
export interface HistorialArco extends ReporteArco {
  movements: Movimiento[]
}

export async function getHistorial(_params?: {
  page?: number
  limit?: number
  isGlobal?: boolean
}): Promise<{ arcos: HistorialArco[]; total: number }> {
  // Obtener el arco actual (el único que expone el backend como JSON)
  const estado = await getArcoEstado(_params?.isGlobal ?? false)

  if (!estado.arco) {
    return { arcos: [], total: 0 }
  }

  const saldo = await getSaldoArco(_params?.isGlobal ?? false).catch(() => null)
  const movs  = await getMovimientosArco(estado.arco.id)
    .then((d) => d.movements)
    .catch(() => [] as Movimiento[])

  const arcoData: HistorialArco = {
    arco: {
      ...estado.arco,
      total_ingresos: saldo?.total_ingresos ?? 0,
      total_egresos:  saldo?.total_egresos  ?? 0,
      total_retiros:  saldo?.total_retiros  ?? 0,
      saldo_final:    saldo?.saldo_total    ?? 0,
    },
    movements: movs,
    saldo:     saldo ?? {
      arqueo_id: estado.arco.id, owner_id: 0, is_global: false,
      turno: estado.arco.turno, activo: true,
      saldo_inicial: 0, total_ingresos: 0,
      total_egresos: 0, total_retiros: 0, saldo_total: 0,
    },
  }

  return { arcos: [arcoData], total: 1 }
}

export async function getMovimientosArcoHistorial(
  arcoId: number
): Promise<Movimiento[]> {
  const data = await getMovimientosArco(arcoId)
  return data.movements ?? []
}
