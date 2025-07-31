package controllers

import (
	"caja-fuerte/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GraficosAPIHandler maneja GET /api/graficos y devuelve movimientos filtrados en JSON
func GraficosAPIHandler(c *gin.Context) {
	fechaDesde := c.Query("fecha_Desde")
	fechaHasta := c.Query("fecha_hasta")
	tipo := c.Query("tipo")
	turno := c.Query("turno")
	montoMinimo := c.Query("monto_Minimo")
	montoMaximo := c.Query("monto_Maximo")
	arcoID := c.Query("arco_id")
	balanceNegativo := c.Query("balance_negativo")

	movs, err := services.GetMovimientosParaGraficos(fechaDesde, fechaHasta, tipo, turno, montoMinimo, montoMaximo, arcoID, balanceNegativo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, movs)
}
