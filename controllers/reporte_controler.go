package controllers

import (
	"caja-fuerte/models"
	"caja-fuerte/services"
	"fmt"
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
	IsGlobal    bool
	Usuario     *models.User
}

// MostrarPaginaReportes muestra el reporte personal del usuario
func MostrarPaginaReportes(ctx *gin.Context) {
	arcoService := services.NewArcoService()
	movementService := services.NewMovementService()
	userID := ctx.GetUint("user_id")

	fmt.Printf("[REPORTE] Usuario %d solicitando reporte personal\n", userID)

	// 1. Obtener el último arco del usuario
	ultimoArco, err := arcoService.GetArcoActivoUsuario(userID)
	if err != nil {
		// Si no hay arco activo, intentar obtener el último arco cerrado
		ultimoArco, err = arcoService.GetLastArcoUsuario(userID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				tmpl, _ := template.ParseFiles("./Front/reporte.html")
				tmpl.Execute(ctx.Writer, ReportData{
					Error: "No se encontró ningún arco para este usuario.",
					IsGlobal: false,
				})
				return
			}
			ctx.String(http.StatusInternalServerError, "Error al obtener el arco: %v", err)
			return
		}
	}

	// 2. Obtener los movimientos para ese arco
	movimientos, err := movementService.GetMovementsByArcoID(ultimoArco.ID)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener los movimientos: %v", err)
		return
	}

	// 3. Obtener el resumen financiero del arco
	resumen, err := arcoService.GetSaldoArcoUsuario(userID, false)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener el resumen financiero: %v", err)
		return
	}

	// 4. Preparar los datos y renderizar la plantilla
	data := ReportData{
		Arco:        ultimoArco,
		Movimientos: movimientos,
		Resumen:     resumen,
		IsGlobal:    false,
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

// MostrarPaginaReporteGlobal muestra el reporte global (SOLO Admin General)
// La caja global es la SUMA de todas las cajas personales activas
func MostrarPaginaReporteGlobal(ctx *gin.Context) {
	arcoService := services.NewArcoService()
	movementService := services.NewMovementService()
	userID := ctx.GetUint("user_id")
	roleID := ctx.GetUint("role_id")

	fmt.Printf("[REPORTE GLOBAL] Usuario %d (RoleID: %d) solicitando reporte global\n", userID, roleID)

	// Verificación adicional de seguridad
	if roleID != 2 {
		ctx.JSON(http.StatusForbidden, gin.H{
			"error": "Solo el Administrador General puede acceder a esta vista",
		})
		return
	}

	// 1. Obtener TODOS los movimientos de TODAS las cajas personales activas
	fmt.Println("[REPORTE GLOBAL] Obteniendo todos los movimientos de todas las cajas activas")
	movimientos, err := movementService.GetAllMovimientosFromAllCajasActivas()
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener los movimientos: %v", err)
		return
	}

	fmt.Printf("[REPORTE GLOBAL] Movimientos encontrados: %d\n", len(movimientos))

	// 2. Obtener el resumen financiero global (suma de todas las cajas)
	resumen, err := arcoService.GetSaldoArcoUsuario(userID, true)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener el resumen financiero global: %v", err)
		return
	}

	fmt.Printf("[REPORTE GLOBAL] Resumen calculado - Saldo Total: %.2f\n", resumen.SaldoTotal)

	// 3. Obtener la caja personal del admin para mostrar en el reporte
	cajaPersonalAdmin, _ := arcoService.GetArcoActivoUsuario(userID)

	// 4. Preparar los datos y renderizar la plantilla
	data := ReportData{
		Arco:        cajaPersonalAdmin, // Puede ser nil si el admin no tiene caja abierta
		Movimientos: movimientos,
		Resumen:     resumen,
		IsGlobal:    true,
	}

	tmpl, err := template.ParseFiles("./Front/reporte_general.html")
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al cargar la plantilla de reporte global: %v", err)
		return
	}

	ctx.Status(http.StatusOK)
	err = tmpl.Execute(ctx.Writer, data)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al renderizar la plantilla: %v", err)
	}
}
