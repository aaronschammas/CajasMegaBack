package controllers

import (
	"caja-fuerte/models"
	"caja-fuerte/services"
	"html/template"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ReportData para la plantilla
type ReportData struct {
	Arco        *models.Arco
	Movimientos []models.Movement
	Resumen     *models.VistaSaldoArqueo
	Error       string
}

// GraficosAPIHandler maneja GET /api/graficos y devuelve movimientos filtrados en JSON
func GraficosAPIHandler(c *gin.Context) {
	// fechaDesde := c.Query("fecha_Desde")
	// fechaHasta := c.Query("fecha_hasta")
	// tipo := c.Query("tipo")
	// turno := c.Query("turno")
	// montoMinimo := c.Query("monto_Minimo")
	// montoMaximo := c.Query("monto_Maximo")
	// arcoID := c.Query("arco_id")
	// balanceNegativo := c.Query("balance_negativo")

	// movs, err := services.GetMovimientosParaGraficos(fechaDesde, fechaHasta, tipo, turno, montoMinimo, montoMaximo, arcoID, balanceNegativo)
	// if err != nil {
	// 	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	// 	return
	// }
	// c.JSON(http.StatusOK, movs)
}

func MostrarPaginaReportes(ctx *gin.Context) {
	arcoService := services.NewArcoService()
	movementService := services.NewMovementService()

	// 1. Obtener el último arco
	ultimoArco, err := arcoService.GetLastArco()
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			tmpl, _ := template.ParseFiles("./Front/reporte.html")
			tmpl.Execute(ctx.Writer, ReportData{Error: "No se encontró ningún arco."})
			return
		}
		ctx.String(http.StatusInternalServerError, "Error al obtener el arco: %v", err)
		return
	}

	// 2. Obtener los movimientos para ese arco
	movimientos, err := movementService.GetMovementsByArcoID(ultimoArco.ID)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener los movimientos: %v", err)
		return
	}

	// 3. Obtener el resumen financiero del último arco
	resumen, err := arcoService.GetSaldoUltimoArco()
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener el resumen financiero: %v", err)
		return
	}

	// 4. Preparar los datos y renderizar la plantilla
	data := ReportData{
		Arco:        ultimoArco,
		Movimientos: movimientos,
		Resumen:     resumen,
	}

	tmpl, err := template.ParseFiles("./Front/reporte.html")
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al cargar la plantilla de reporte: %v", err)
		return
	}

	ctx.Status(http.StatusOK)
	err = tmpl.Execute(ctx.Writer, data)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al renderizar la plantilla: %v", err)
	}
}
