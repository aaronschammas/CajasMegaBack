package controllers

import (
	"caja-fuerte/services"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GET /api/arco-estado
func EstadoArcoAPIHandler(ctx *gin.Context) {
	arcoService := services.NewArcoService()
	abierto, err := arcoService.UltimoArcoAbiertoOCerrado()
	if err != nil {
		ctx.JSON(500, gin.H{"error": err.Error()})
		return
	}
	ultimo, err := arcoService.GetLastArco()
	if err != nil {
		ctx.JSON(200, gin.H{"arco_abierto": abierto, "arco": nil})
		return
	}
	ctx.JSON(200, gin.H{"arco_abierto": abierto, "arco": ultimo})
}

// GET /api/saldo-ultimo-arco
func SaldoUltimoArcoHandler(ctx *gin.Context) {
	arcoService := services.NewArcoService()
	saldo, err := arcoService.GetSaldoUltimoArco()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo obtener el saldo actual"})
		return
	}
	// Log para depuración
	fmt.Printf("[DEBUG] Objeto saldo obtenido de la DB: %+v\n", saldo)
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
func (c *ArcoController) AbrirArco(ctx *gin.Context) {
	turno := ctx.PostForm("turno")
	if turno != "M" && turno != "T" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "turno inválido"})
		return
	}
	userID := ctx.GetUint("user_id")
	userEmail := ctx.GetString("email")
	fmt.Println("[ARCO] Datos extraídos del contexto: user_id=", userID, "email=", userEmail)
	if userID == 0 {
		fmt.Println("[ARCO] ERROR: user_id=0. El usuario no está autenticado correctamente o el token es inválido.")
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado correctamente. Por favor, cierre sesión y vuelva a iniciar."})
		return
	}
	arco, err := c.arcoService.AbrirArco(userID, turno)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
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
	// Opcional: recibir monto de retiro enviado por el cliente para crear el RetiroCaja durante el cierre
	retiroStr := ctx.PostForm("retiro_amount")
	var retiroAmount float64
	if retiroStr != "" {
		if v, err := strconv.ParseFloat(retiroStr, 64); err == nil {
			retiroAmount = v
		}
	}

	arco, err := c.arcoService.CerrarArcoConRetiro(uint(arcoID), userID, retiroAmount)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, arco)
}

// GET /arco/estado
func (c *ArcoController) EstadoArco(ctx *gin.Context) {
	arcoService := c.arcoService
	activo, err := arcoService.UltimoArcoAbiertoOCerrado()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ultimoArco, err := arcoService.GetLastArco()
	if err != nil {
		// Si no hay arco, retornamos null
		ctx.JSON(http.StatusOK, gin.H{"arco_abierto": activo, "arco": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"arco_abierto": activo, "arco": ultimoArco})
}

// POST /arco/abrir-avanzado
func (c *ArcoController) AbrirArcoAvanzado(ctx *gin.Context) {
	turno := ctx.PostForm("turno")
	forzarNuevo := ctx.PostForm("forzar_nuevo") == "true"
	userID := ctx.GetUint("user_id")
	arcoService := c.arcoService
	// Consultar el último arco global (por ID)
	ultimo, err := c.arcoService.GetLastArco()
	if err != nil || ultimo == nil || (ultimo.FechaCierre != nil && !ultimo.Activo) {
		// No hay arco abierto, abrir uno nuevo
		arco, err := arcoService.AbrirArco(userID, turno)
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
		ctx.JSON(http.StatusConflict, gin.H{"arco": ultimo, "msg": "Ya hay un arco abierto. ¿Desea continuar con el actual o abrir uno nuevo?"})
		return
	}
	// Si forzarNuevo o el arco está cerrado, abrir uno nuevo
	arco, err := arcoService.AbrirArco(userID, turno)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx.SetCookie("arco_abierto", "true", 3600, "/", "", false, true)
	ctx.JSON(http.StatusOK, arco)
}
