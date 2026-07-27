// ─── Tipo Concepto — alineado con ConceptType (models.go) ───────────────────
//
// JSON tags del modelo Go: concept_id, concept_name, movement_type_association, is_active

export interface Concepto {
  id:           number    // concept_id en el backend
  concept_name: string
  concept_type: 'Ingreso' | 'Egreso' | 'RetiroCaja' | 'Ambos'  // movement_type_association
  description?: string
  is_active:    boolean
}
