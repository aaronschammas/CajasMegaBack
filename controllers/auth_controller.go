package controllers

import (
	"caja-fuerte/services" //
	"fmt"                  //
	"net/http"             //

	"github.com/gin-gonic/gin" //
)

type AuthController struct { //
	authService *services.AuthService //
}

func NewAuthController() *AuthController { //
	return &AuthController{ //
		authService: services.NewAuthService(), //
	}
}

func (c *AuthController) Login(ctx *gin.Context) {
	if ctx.Request.Method == "GET" {
		// Sirve el HTML del login directamente
		ctx.File("./Front/index.html")
		return
	}

	// POST: Procesa login desde formulario HTML estándar (no JSON)
	email := ctx.PostForm("email")
	password := ctx.PostForm("password")
	if email == "" || password == "" {
		// Renderiza el login con mensaje de error
		ctx.Writer.WriteHeader(http.StatusBadRequest)
		ctx.Writer.Write([]byte(`<html><head><meta http-equiv='refresh' content='2;url=/api/login'></head><body><p style='color:red;text-align:center;'>Email y contraseña requeridos</p></body></html>`))
		return
	}

	token, user, err := c.authService.Login(email, password)
	if err != nil {
		ctx.Writer.WriteHeader(http.StatusUnauthorized)
		ctx.Writer.Write([]byte(`<html><head><meta http-equiv='refresh' content='2;url=/api/login'></head><body><p style='color:red;text-align:center;'>Credenciales inválidas</p></body></html>`))
		return
	}

	if token == "" {
		fmt.Println("[LOGIN] Token NO encontrado para usuario:", email)
	} else {
		fmt.Println("[LOGIN] Token generado para usuario:", email, "ID:", user.UserID, "Token:", token)
	}

	// Consultar el último arco :)
	arcoService := services.NewArcoService()
	arcoAbierto, err := arcoService.UltimoArcoAbiertoOCerrado()
	if err != nil {
		fmt.Println("[LOGIN] Error al consultar último arco:", err)
	} else if arcoAbierto {
		fmt.Println("[LOGIN] El último arco global está abierto. Se debe cerrar antes de abrir uno nuevo.")
		// Aquí puedes tomar acción automática o solo informar
	} else {
		fmt.Println("[LOGIN] No hay arco abierto. Se puede crear uno nuevo.")
	}
	// --- FIN INTEGRACIÓN ARCO ---

	// Crear cookie de sesión JWT (ambos nombres para máxima compatibilidad)
	ctx.SetCookie("session_token", token, 3600, "/", "", false, true)
	ctx.SetCookie("jwt", token, 3600, "/", "", false, true)
	ctx.Redirect(http.StatusFound, "/movimientos")
}

func (c *AuthController) Logout(ctx *gin.Context) { //
	// En implementación JWT stateless, el logout se maneja en el frontend
	ctx.JSON(http.StatusOK, gin.H{"message": "Logout exitoso"}) //
}
