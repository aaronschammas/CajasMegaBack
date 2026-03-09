package controllers

import (
	"caja-fuerte/services"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GET /api/saldo-ultimo-arco
func SaldoUltimoArcoHandler(ctx *gin.Context) {
	arcoService := services.NewArcoService()
	userID := ctx.GetUint("user_id")

	// Verificar qué tipo de saldo se está consultando
	isGlobalStr := ctx.Query("is_global")
	isGlobal := isGlobalStr == "true" || isGlobalStr == "1"

	fmt.Printf("[DEBUG] SaldoUltimoArcoHandler - UserID: %d, isGlobal: %t\n", userID, isGlobal)

	// ✅ NOTA: El middleware RequirePermission ya validó permisos
	// Si llegamos aquí, el usuario tiene permiso de lectura

	saldo, err := arcoService.GetSaldoArcoUsuario(userID, isGlobal)
	if err != nil {
		fmt.Printf("[ERROR] Error al obtener saldo: %v\n", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error":      err.Error(),
			"sugerencia": "Verifica que exista una caja abierta del tipo solicitado",
		})
		return
	}

	fmt.Printf("[DEBUG] Saldo obtenido exitosamente - ArqueoID: %d, IsGlobal: %t, SaldoTotal: %.2f\n",
		saldo.ArqueoID, saldo.IsGlobal, saldo.SaldoTotal)

	ctx.JSON(http.StatusOK, saldo)
}

type ArcoController struct {
	arcoService *services.ArcoService
}

func NewArcoController() *ArcoController {
	return &ArcoController{
		arcoService: services.NewArcoService(),
	}
}

// POST /arco/abrir
// Abre una caja personal para el usuario. Ya no existen cajas globales físicas.
func (c *ArcoController) AbrirArco(ctx *gin.Context) {
	turno := ctx.PostForm("turno")
	if turno != "M" && turno != "T" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "turno inválido"})
		return
	}

	userID := ctx.GetUint("user_id")
	userEmail := ctx.GetString("email")

	fmt.Printf("[ARCO] Usuario %s (%d) abriendo caja personal - turno: %s\n", userEmail, userID, turno)

	if userID == 0 {
		fmt.Println("[ARCO] ERROR: user_id=0. Usuario no autenticado.")
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error": "Usuario no autenticado. Por favor, inicie sesión nuevamente.",
		})
		return
	}

	// Ignorar parámetro is_global por compatibilidad - siempre se abre caja personal
	// El middleware RequirePermission ya validó que el usuario tiene PermOpenOwnArco

	arco, err := c.arcoService.AbrirArco(userID, turno, false)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("[ARCO] Caja personal abierta exitosamente - ID: %d, Owner: %d\n", arco.ID, arco.OwnerID)

	ctx.JSON(http.StatusOK, arco)
}

// POST /arco/cerrar
func (c *ArcoController) CerrarArco(ctx *gin.Context) {
	arcoIDstr := ctx.PostForm("arco_id")
	arcoID, err := strconv.Atoi(arcoIDstr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "arco_id inválido"})
		return
	}
	userID := ctx.GetUint("user_id")

	// Recibir monto de retiro y total contado
	retiroStr := ctx.PostForm("retiro_amount")
	var retiroAmount float64
	if retiroStr != "" {
		if v, err := strconv.ParseFloat(retiroStr, 64); err == nil {
			retiroAmount = v
		}
	}

	totalContadoStr := ctx.PostForm("total_contado")
	var totalContado float64
	if totalContadoStr != "" {
		if v, err := strconv.ParseFloat(totalContadoStr, 64); err == nil {
			totalContado = v
		}
	}

	arco, err := c.arcoService.CerrarArcoConRetiro(uint(arcoID), userID, retiroAmount)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Calcular diferencia si se envió total contado
	var diferencia float64
	if totalContado > 0 {
		diferencia = totalContado - arco.SaldoFinal
	}

	ctx.JSON(http.StatusOK, gin.H{
		"arco":          arco,
		"diferencia":    diferencia,
		"total_contado": totalContado,
	})
}

// POST /arco/abrir-avanzado
// Abre una caja personal con opciones avanzadas
func (c *ArcoController) AbrirArcoAvanzado(ctx *gin.Context) {
	turno := ctx.PostForm("turno")
	forzarNuevo := ctx.PostForm("forzar_nuevo") == "true"
	userID := ctx.GetUint("user_id")

	// Ignorar parámetro is_global por compatibilidad - siempre caja personal
	// El middleware RequirePermission ya validó permisos

	arcoService := c.arcoService

	fmt.Printf("[ARCO] Buscando arco personal activo para usuario %d\n", userID)
	ultimo, err := arcoService.GetArcoActivoUsuario(userID)

	if err != nil || ultimo == nil || !ultimo.Activo {
		// No hay arco abierto, abrir uno nuevo
		arco, err := arcoService.AbrirArco(userID, turno, false)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		ctx.SetCookie("arco_abierto", "true", 3600, "/", "", false, true)
		ctx.JSON(http.StatusOK, arco)
		return
	}

	if ultimo.Activo && !forzarNuevo {
		// Hay un arco abierto, preguntar al usuario si continuar o forzar
		ctx.JSON(http.StatusConflict, gin.H{
			"arco": ultimo,
			"msg":  "Ya hay una caja personal abierta. ¿Desea continuar con la actual o abrir una nueva?",
		})
		return
	}

	// Si forzarNuevo, abrir uno nuevo
	arco, err := arcoService.AbrirArco(userID, turno, false)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx.SetCookie("arco_abierto", "true", 3600, "/", "", false, true)
	ctx.JSON(http.StatusOK, arco)
}
