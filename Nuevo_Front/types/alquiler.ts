// ─── Tipos del módulo de Alquileres ──────────────────────────────────────────

export type EstadoPago = 'paid' | 'pending' | 'late_1' | 'late_2'

export interface PagoMes {
  mes:    number      // 0-11
  estado: EstadoPago
  monto:  number      // monto pagado (solo si estado === 'paid')
}

export interface Propiedad {
  id:                      string
  direccion:               string
  inquilino?:              string
  ocupada:                 boolean
  alquiler_mensual:        number
  paga_en_dolares:         boolean
  monto_dolares?:          number
  indice_inflacion?:       number
  fecha_actualizacion?:    string   // ISO string
  frecuencia_actualizacion?: number // meses
  pagos:                   PagoMes[]
  imagenes?:               string[] // base64 o URLs
  metadata?:               Record<string, string>
}

export interface ResumenKPIs {
  ingreso_anual_proyectado: number
  deuda_total:              number
  tasa_ocupacion:           number
  pagos_atrasados:          number
  meses_pendientes_total:   number
  propiedades_ocupadas:     number
  total_propiedades:        number
  propiedades_con_atraso:   number
}

export interface ResumenMovimientos {
  total_monto: number
  cantidad:    number
}

// ─── Actualización de monto ───────────────────────────────────────────────────
export interface InflacionMes {
  periodo: string  // "Mar 2025"
  pct:     number
}

export interface DatosInflacion {
  fuente:         string
  meses:          InflacionMes[]
  acumulado_pct:  number
}

export interface ActualizacionPendiente {
  propiedad:          Propiedad
  monto_actual:       number
  monto_recomendado:  number
  inflacion:          DatosInflacion
}

// ─── Filtros de la tabla ──────────────────────────────────────────────────────
export type FiltroEstado = '' | 'aldia' | 'atraso1' | 'atraso2' | 'desocupadas'
