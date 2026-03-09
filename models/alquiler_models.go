package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// EstadoPago define los posibles estados de un mes de alquiler
type EstadoPago string

const (
	PagadoEstado    EstadoPago = "paid"
	PendienteEstado EstadoPago = "pending"
	Atraso1Estado   EstadoPago = "late_1"
	Atraso2Estado   EstadoPago = "late_2"
)

// PagoMes representa el estado de pago de un mes específico
type PagoMes struct {
	Mes        int        `bson:"mes" json:"mes"`
	Estado     EstadoPago `bson:"estado" json:"estado"`
	Monto      float64    `bson:"monto" json:"monto"`
	FechaPago  *time.Time `bson:"fecha_pago,omitempty" json:"fecha_pago,omitempty"`
	MovementID *uint      `bson:"movement_id,omitempty" json:"movement_id,omitempty"`
}

// Propiedad es el documento principal almacenado en MongoDB.
type Propiedad struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Direccion       string             `bson:"direccion" json:"direccion"`
	Inquilino       string             `bson:"inquilino" json:"inquilino"`
	AlquilerMensual float64            `bson:"alquiler_mensual" json:"alquiler_mensual"`
	Ocupada         bool               `bson:"ocupada" json:"ocupada"`

	// ── Modo pesos (contrato con actualización) ──────────────────────────────
	IndiceInflacion         float64    `bson:"indice_inflacion" json:"indice_inflacion"`
	FechaActualizacion      *time.Time `bson:"fecha_actualizacion,omitempty" json:"fecha_actualizacion,omitempty"`
	// FrecuenciaActualizacion: cada cuántos meses se actualiza el monto (mínimo 3)
	FrecuenciaActualizacion int        `bson:"frecuencia_actualizacion" json:"frecuencia_actualizacion"`
	// PosponerHasta: si el gestor pospone la notificación, no se muestra hasta esta fecha
	PosponerHasta           *time.Time `bson:"posponer_hasta,omitempty" json:"posponer_hasta,omitempty"`

	// Campos legacy
	MesInicio int `bson:"mes_inicio" json:"mes_inicio"`

	// ── Modo dólares ─────────────────────────────────────────────────────────
	// Cuando PagaEnDolares=true, MontoDolares es el valor fijo en USD.
	// AlquilerMensual se actualiza manualmente con la cotización del mes.
	// Las actualizaciones por inflación no aplican.
	PagaEnDolares bool    `bson:"paga_en_dolares" json:"paga_en_dolares"`
	MontoDolares  float64 `bson:"monto_dolares" json:"monto_dolares"`

	// ── Imágenes ─────────────────────────────────────────────────────────────
	// Almacenadas como data-URLs base64 (formato: "data:image/jpeg;base64,...")
	Imagenes []string `bson:"imagenes" json:"imagenes"`

	// ── Campos generales ─────────────────────────────────────────────────────
	Anio      int                    `bson:"anio" json:"anio"`
	Pagos     []PagoMes              `bson:"pagos" json:"pagos"`
	Metadata  map[string]interface{} `bson:"metadata" json:"metadata"`
	CreatedAt time.Time              `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time              `bson:"updated_at" json:"updated_at"`
	CreatedBy uint                   `bson:"created_by" json:"created_by"`
}

// RegistrarPagoRequest es el body para marcar un mes como pagado
type RegistrarPagoRequest struct {
	// Mes usa omitempty para que mes=0 (Enero) no falle la validación required
	Mes   int     `json:"mes" binding:"min=0,max=11"`
	Monto float64 `json:"monto" binding:"required,gt=0"`
}

// CrearPropiedadRequest es el body para crear una propiedad
type CrearPropiedadRequest struct {
	Direccion       string  `json:"direccion" binding:"required"`
	Inquilino       string  `json:"inquilino"`
	AlquilerMensual float64 `json:"alquiler_mensual" binding:"required,gt=0"`
	Ocupada         bool    `json:"ocupada"`
	// Modo pesos
	IndiceInflacion         float64    `json:"indice_inflacion"`
	FechaActualizacion      *time.Time `json:"fecha_actualizacion"`
	// Cada cuántos meses se actualiza (mínimo 3, 0 = sin actualización automática)
	FrecuenciaActualizacion int        `json:"frecuencia_actualizacion"`
	// Modo dólares
	PagaEnDolares bool    `json:"paga_en_dolares"`
	MontoDolares  float64 `json:"monto_dolares"`
	// Imágenes
	Imagenes []string `json:"imagenes"`
	// Metadata libre
	Metadata map[string]interface{} `json:"metadata"`
}

// ActualizarPropiedadRequest es el body para modificar una propiedad
type ActualizarPropiedadRequest struct {
	Direccion       *string  `json:"direccion"`
	Inquilino       *string  `json:"inquilino"`
	AlquilerMensual *float64 `json:"alquiler_mensual"`
	Ocupada         *bool    `json:"ocupada"`
	// Modo pesos
	IndiceInflacion         *float64   `json:"indice_inflacion"`
	FechaActualizacion      *time.Time `json:"fecha_actualizacion"`
	FrecuenciaActualizacion *int       `json:"frecuencia_actualizacion"`
	// Modo dólares
	PagaEnDolares *bool    `json:"paga_en_dolares"`
	MontoDolares  *float64 `json:"monto_dolares"`
	// Imágenes
	Imagenes *[]string `json:"imagenes"`
	// Metadata libre (merge de campos)
	Metadata map[string]interface{} `json:"metadata"`
}

// ── Tipos para el sistema de notificación de actualización de alquiler ─────────────

// MesInflacion representa el dato IPC de un mes específico
type MesInflacion struct {
	Periodo string  `json:"periodo"` // "Mar 2025"
	Pct     float64 `json:"pct"`     // 3.7 (= 3.7%)
}

// DetalleInflacion es el resultado del cálculo de inflación acumulada
type DetalleInflacion struct {
	Meses         []MesInflacion `json:"meses"`
	AcumuladoPct  float64        `json:"acumulado_pct"`   // ej: 8.73 (%)
	Fuente        string         `json:"fuente"`
	FechaConsulta time.Time      `json:"fecha_consulta"`
	Error         string         `json:"error,omitempty"` // si hubo error al consultar la API
}

// PropiedadActualizacion es la respuesta del endpoint de actualizaciones pendientes
type PropiedadActualizacion struct {
	Propiedad        Propiedad        `json:"propiedad"`
	Inflacion        *DetalleInflacion `json:"inflacion"`
	MontoActual      float64          `json:"monto_actual"`
	MontoRecomendado float64          `json:"monto_recomendado"`
}

// ActualizarMontoRequest es el body para confirmar la actualización de monto
type ActualizarMontoRequest struct {
	NuevoMonto             float64    `json:"nuevo_monto" binding:"required,gt=0"`
	NuevaFechaActualizacion *time.Time `json:"nueva_fecha_actualizacion"`
	Notas                  string     `json:"notas"`
}

// PosponerRequest es el body para posponer la notificación de una propiedad
type PosponerRequest struct {
	PosponerHasta time.Time `json:"posponer_hasta" binding:"required"`
}

// ResumenAlquileres agrupa los KPIs del módulo
type ResumenAlquileres struct {
	IngresoAnualProyectado float64 `json:"ingreso_anual_proyectado"`
	DeudaTotal             float64 `json:"deuda_total"`
	MesesPendientesTotal   int     `json:"meses_pendientes_total"`
	TasaOcupacion          float64 `json:"tasa_ocupacion"`
	PropiedadesOcupadas    int     `json:"propiedades_ocupadas"`
	TotalPropiedades       int     `json:"total_propiedades"`
	PagosAtrasados         int     `json:"pagos_atrasados"`
	PropiedadesConAtraso   int     `json:"propiedades_con_atraso"`
}
