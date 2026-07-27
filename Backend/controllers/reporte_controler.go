package controllers

import (
	"caja-fuerte/models"
	"caja-fuerte/services"
	"fmt"
	"html/template"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// reporteFuncMap contiene las funciones disponibles en los templates de reporte.
// formatMonto convierte un float64 a string con separador de miles y 2 decimales
// usando el estilo argentino: 1.234.567,89
var reporteFuncMap = template.FuncMap{
	"formatMonto": func(v float64) string {
		// Manejar negativos
		neg := v < 0
		v = math.Abs(v)

		// Parte entera y decimal
		parteEntera := int64(v)
		parteDecimal := int64(math.Round((v-float64(parteEntera))*100))

		// Separador de miles (punto)
		s := strconv.FormatInt(parteEntera, 10)
		result := ""
		for i, c := range s {
			if i > 0 && (len(s)-i)%3 == 0 {
				result += "."
			}
			result += string(c)
		}

		// Decimales con coma
		result = result + "," + fmt.Sprintf("%02d", parteDecimal)

		if neg {
			return "-" + result
		}
		return result
	},
	// formatSigno devuelve "+" para ingresos y "-" para egresos
	"formatSigno": func(tipo string) string {
		if strings.ToLower(tipo) == "ingreso" {
			return "+"
		}
		return "-"
	},
}

// reporteTemplate carga el template de reporte con el FuncMap registrado.
func reporteTemplate(file string) (*template.Template, error) {
	return template.New(file).Funcs(reporteFuncMap).ParseFiles("./Front/" + file)
}

// ReportData para la plantilla
type ReportData struct {
	Arco        *models.Arco
	Movimientos []models.Movement
	Resumen     *models.VistaSaldoArqueo
	Error       string
	IsGlobal    bool
	IsAdmin     bool   // true si el usuario es Administrador General
	Usuario     *models.User
}

// MostrarPaginaReportes muestra el reporte del usuario.
// Si el usuario es Admin General y pasa ?vista=global, muestra todos los movimientos
// de todas las cajas activas en lugar del reporte personal.
func MostrarPaginaReportes(ctx *gin.Context) {
	arcoService := services.NewArcoService()
	movementService := services.NewMovementService()
	userID := ctx.GetUint("user_id")
	roleID := ctx.GetUint("role_id")

	isAdmin := roleID == 2
	vistaGlobal := isAdmin && ctx.Query("vista") == "global"

	fmt.Printf("[REPORTE] Usuario %d (admin=%v, vistaGlobal=%v) solicitando reporte\n", userID, isAdmin, vistaGlobal)

	// ── VISTA GLOBAL (solo Admin) ───────────────────────────────────────────
	if vistaGlobal {
		movimientos, err := movementService.GetAllMovimientosFromAllCajasActivas()
		if err != nil {
			ctx.String(http.StatusInternalServerError, "Error al obtener movimientos globales: %v", err)
			return
		}

		resumen, err := arcoService.GetSaldoArcoUsuario(userID, true)
		if err != nil {
			ctx.String(http.StatusInternalServerError, "Error al obtener resumen global: %v", err)
			return
		}

		// Caja personal del admin (para info de arco, puede ser nil)
		cajaAdmin, _ := arcoService.GetArcoActivoUsuario(userID)

		data := ReportData{
			Arco:        cajaAdmin,
			Movimientos: movimientos,
			Resumen:     resumen,
			IsGlobal:    true,
			IsAdmin:     true,
		}

		tmpl, err := reporteTemplate("reporte.html")
		if err != nil {
			ctx.String(http.StatusInternalServerError, "Error al cargar la plantilla: %v", err)
			return
		}
		ctx.Status(http.StatusOK)
		ctx.Header("Content-Type", "text/html; charset=utf-8")
		tmpl.Execute(ctx.Writer, data)
		return
	}

	// ── VISTA PERSONAL (comportamiento original) ────────────────────────────
	ultimoArco, err := arcoService.GetArcoActivoUsuario(userID)
	if err != nil {
		ultimoArco, err = arcoService.GetLastArcoUsuario(userID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				tmpl, _ := reporteTemplate("reporte.html")
				tmpl.Execute(ctx.Writer, ReportData{
					Error:    "No se encontró ningún arco para este usuario.",
					IsGlobal: false,
					IsAdmin:  isAdmin,
				})
				return
			}
			ctx.String(http.StatusInternalServerError, "Error al obtener el arco: %v", err)
			return
		}
	}

	movimientos, err := movementService.GetMovementsByArcoID(ultimoArco.ID)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener los movimientos: %v", err)
		return
	}

	resumen, err := arcoService.GetSaldoArcoUsuario(userID, false)
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al obtener el resumen financiero: %v", err)
		return
	}

	data := ReportData{
		Arco:        ultimoArco,
		Movimientos: movimientos,
		Resumen:     resumen,
		IsGlobal:    false,
		IsAdmin:     isAdmin,
	}

	tmpl, err := reporteTemplate("reporte.html")
	if err != nil {
		ctx.String(http.StatusInternalServerError, "Error al cargar la plantilla de reporte: %v", err)
		return
	}

	ctx.Status(http.StatusOK)
	ctx.Header("Content-Type", "text/html; charset=utf-8")
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
