// ─── Tipos del módulo Arco — alineados con los modelos Go ────────────────────
//
// Arco (models.go):
//   id, created_by, owner_id, is_global, fecha_apertura, hora_apertura,
//   fecha_cierre, hora_cierre, turno, activo, fecha, saldo_inicial, saldo_final
//
// VistaSaldoArqueo (models.go):
//   arqueo_id, owner_id, is_global, fecha_apertura, fecha_cierre, turno,
//   activo, saldo_inicial, total_ingresos, total_egresos, total_retiros, saldo_total

export interface Arco {
  id:             number
  created_by:     number
  owner_id:       number
  is_global:      boolean
  fecha_apertura: string    // ISO string
  hora_apertura?: string
  fecha_cierre?:  string
  hora_cierre?:   string
  turno:          'M' | 'T'
  activo:         boolean
  fecha?:         string
  saldo_inicial:  number
  saldo_final:    number
  usuario?:       { user_id: number; full_name: string; email: string }
  owner?:         { user_id: number; full_name: string }
}

// VistaSaldoArqueo — respuesta de GET /api/saldo-ultimo-arco
export interface SaldoArco {
  arqueo_id:      number
  owner_id:       number
  is_global:      boolean
  fecha_apertura?: string
  fecha_cierre?:  string
  turno:          string
  activo:         boolean
  saldo_inicial:  number
  total_ingresos: number
  total_egresos:  number
  total_retiros:  number
  saldo_total:    number   // saldo_inicial + ingresos - egresos - retiros
}

// Respuesta de GET /api/arco-estado
export interface ArcoEstado {
  arco_abierto: boolean
  arco?:        Arco
}

export type TipoCaja = 'personal' | 'global'

// Para la calculadora de billetes
export interface BillCounts {
  20000: number
  10000: number
  2000:  number
  1000:  number
  resto: number
}
