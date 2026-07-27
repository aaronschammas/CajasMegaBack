package controllers

import (
	"caja-fuerte/models"
	"caja-fuerte/services"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type AlquilerController struct {
	service *services.AlquilerService
}

func NewAlquilerController() *AlquilerController {
	return &AlquilerController{
		service: services.NewAlquilerService(),
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Página HTML principal
// ─────────────────────────────────────────────────────────────────────────────

// AlquileresPage sirve la SPA de gestión de alquileres.
func (c *AlquilerController) AlquileresPage(ctx *gin.Context) {
	ctx.File("./Front/alquileres.html")
}

// ─────────────────────────────────────────────────────────────────────────────
// API CRUD Propiedades
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/alquileres/propiedades
func (c *AlquilerController) GetPropiedades(ctx *gin.Context) {
	busqueda := ctx.Query("busqueda")
	estado := ctx.Query("estado")
	anioStr := ctx.Query("anio")

	anio := time.Now().Year()
	if anioStr != "" {
		if v, err := strconv.Atoi(anioStr); err == nil {
			anio = v
		}
	}

	props, err := c.service.GetPropiedades(busqueda, estado, anio)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener propiedades: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"propiedades": props,
		"total":       len(props),
		"anio":        anio,
	})
}

// GET /api/alquileres/propiedades/:id
func (c *AlquilerController) GetPropiedadByID(ctx *gin.Context) {
	id := ctx.Param("id")
	prop, err := c.service.GetPropiedadByID(id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, prop)
}

// POST /api/alquileres/propiedades
func (c *AlquilerController) CrearPropiedad(ctx *gin.Context) {
	var req models.CrearPropiedadRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos: " + err.Error()})
		return
	}

	userID := ctx.GetUint("user_id")
	prop, err := c.service.CrearPropiedad(req, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear propiedad: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"message":   "Propiedad creada exitosamente",
		"propiedad": prop,
	})
}

// PUT /api/alquileres/propiedades/:id
func (c *AlquilerController) ActualizarPropiedad(ctx *gin.Context) {
	id := ctx.Param("id")
	var req models.ActualizarPropiedadRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos: " + err.Error()})
		return
	}

	prop, err := c.service.ActualizarPropiedad(id, req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":   "Propiedad actualizada",
		"propiedad": prop,
	})
}

// DELETE /api/alquileres/propiedades/:id
func (c *AlquilerController) EliminarPropiedad(ctx *gin.Context) {
	id := ctx.Param("id")
	if err := c.service.EliminarPropiedad(id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Propiedad eliminada"})
}

// DELETE /api/alquileres/propiedades/:id/metadata/:campo
func (c *AlquilerController) EliminarMetadataField(ctx *gin.Context) {
	id := ctx.Param("id")
	campo := ctx.Param("campo")

	prop, err := c.service.EliminarMetadataField(id, campo)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Campo eliminado", "propiedad": prop})
}

// ─────────────────────────────────────────────────────────────────────────────
// API Pagos
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/alquileres/propiedades/:id/pago
func (c *AlquilerController) RegistrarPago(ctx *gin.Context) {
	id := ctx.Param("id")
	var req models.RegistrarPagoRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos: " + err.Error()})
		return
	}

	userID := ctx.GetUint("user_id")
	prop, err := c.service.RegistrarPago(id, req, userID)
	if err != nil {
		// Log detallado para facilitar el diagnóstico
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "detalle": "prop=" + id + " mes=" + strconv.Itoa(req.Mes)})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":   "Pago registrado exitosamente",
		"propiedad": prop,
	})
}

// DELETE /api/alquileres/propiedades/:id/pago/:mes
func (c *AlquilerController) DeshacerPago(ctx *gin.Context) {
	id := ctx.Param("id")
	mesStr := ctx.Param("mes")
	mes, err := strconv.Atoi(mesStr)
	if err != nil || mes < 0 || mes > 11 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Mes inválido"})
		return
	}

	userID := ctx.GetUint("user_id")
	prop, err := c.service.DeshacerPago(id, mes, userID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":   "Pago revertido",
		"propiedad": prop,
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// API Resumen / Reportes (solo Admin General)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/alquileres/resumen
func (c *AlquilerController) GetResumen(ctx *gin.Context) {
	anioStr := ctx.Query("anio")
	anio := 0
	if anioStr != "" {
		if v, err := strconv.Atoi(anioStr); err == nil {
			anio = v
		}
	}

	resumen, err := c.service.GetResumen(anio)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, resumen)
}

// GET /api/alquileres/resumen/movimientos?periodo=dia|mes|anio
func (c *AlquilerController) GetResumenMovimientos(ctx *gin.Context) {
	periodo := ctx.DefaultQuery("periodo", "mes")
	if periodo != "dia" && periodo != "mes" && periodo != "anio" {
		periodo = "mes"
	}

	resultado, err := c.service.GetMovimientosAlquiler(periodo)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, resultado)
}

// GET /api/alquileres/actualizaciones-pendientes
func (c *AlquilerController) GetActualizacionesPendientes(ctx *gin.Context) {
	resultado, err := c.service.GetActualizacionesPendientes()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener actualizaciones: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"pendientes": resultado,
		"total":      len(resultado),
	})
}

// PUT /api/alquileres/propiedades/:id/actualizar-monto
func (c *AlquilerController) ActualizarMonto(ctx *gin.Context) {
	id := ctx.Param("id")
	var req models.ActualizarMontoRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos: " + err.Error()})
		return
	}

	prop, err := c.service.ActualizarMonto(id, req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"message":   "Monto actualizado correctamente",
		"propiedad": prop,
	})
}

// POST /api/alquileres/propiedades/:id/posponer
func (c *AlquilerController) PosponerActualizacion(ctx *gin.Context) {
	id := ctx.Param("id")
	var req models.PosponerRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos: " + err.Error()})
		return
	}

	prop, err := c.service.PosponerActualizacion(id, req.PosponerHasta)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"message":        "Actualización pospuesta",
		"posponer_hasta": req.PosponerHasta.Format("02/01/2006"),
		"propiedad":      prop,
	})
}

// POST /api/alquileres/actualizar-morosos (puede llamarse vía cron o manualmente)
func (c *AlquilerController) ActualizarMorosos(ctx *gin.Context) {
	if err := c.service.ActualizarEstadosMorosos(); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Estados de morosidad actualizados"})
}
