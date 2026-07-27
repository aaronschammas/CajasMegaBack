// ─── Tipos de Movimiento — alineados con models.go ───────────────────────────
//
// Movement JSON tags:
//   movement_id, reference_id, movement_type, movement_date, amount, shift,
//   concept_id, details, created_by, arco_id, concept, creator

export interface Movimiento {
  movement_id:   number
  reference_id?: string
  movement_type: 'Ingreso' | 'Egreso' | 'RetiroCaja'
  movement_date: string       // ISO string
  amount:        number
  shift:         'M' | 'T'
  concept_id:    number
  details?:      string
  created_by:    number
  arco_id:       number
  concept?: {
    concept_id:               number
    concept_name:             string
    movement_type_association: string
  }
  creator?: {
    user_id:   number
    full_name: string
    email?:    string
  }
}

// Para la pila local (staging antes de enviar al backend)
// Usa los mismos campos que MovementRequest del backend
export interface MovimientoPendiente {
  movement_type: 'Ingreso' | 'Egreso'
  amount:        number
  shift:         'M' | 'T'
  concept_id:    number
  details?:      string
  created_by:    number
  arco_id:       number
  fecha:         string   // display only, no se envía al backend
}
