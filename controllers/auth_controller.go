package controllers

import (
	"caja-fuerte/config"
	"caja-fuerte/models"
	"caja-fuerte/services"
	"caja-fuerte/utils"
	"caja-fuerte/validators"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AuthController struct {
	authService *services.AuthService
}

func NewAuthController() *AuthController {
	return &AuthController{
		authService: services.NewAuthService(),
	}
}

func (c *AuthController) Login(ctx *gin.Context) {
	// Verificar si es GET (mostrar página de login)
	if ctx.Request.Method == "GET" {
		ctx.File("./Front/index.html")
		return
	}

	// POST: Procesar login
	email := ctx.PostForm("email")
	password := ctx.PostForm("password")
	clientIP := ctx.ClientIP()

	// Validar inputs
	if err := validators.ValidateLoginRequest(email, password); err != nil {
		utils.Logger.Warn("Invalid login attempt - validation failed",
			zap.String("email", email),
			zap.String("ip", clientIP),
			zap.Error(err),
		)

		ctx.Writer.WriteHeader(http.StatusBadRequest)
		ctx.Writer.Write([]byte(`
			<html>
				<head>
					<meta http-equiv='refresh' content='3;url=/api/login'>
				</head>
				<body style="font-family: sans-serif; text-align: center; padding: 50px;">
					<h2 style="color: #ef4444;">❌ Error de Validación</h2>
					<p>` + err.Error() + `</p>
					<p style="color: #6b7280;">Redirigiendo...</p>
				</body>
			</html>`))
		return
	}

	// Sanitizar email
	email, _ = validators.ValidateAndSanitizeEmail(email)

	// Intentar autenticación
	token, user, err := c.authService.Login(email, password)
	if err != nil {
		// Log de intento fallido
		utils.LogAuthAttempt(email, false, clientIP)

		ctx.Writer.WriteHeader(http.StatusUnauthorized)
		ctx.Writer.Write([]byte(`
			<html>
				<head>
					<meta http-equiv='refresh' content='3;url=/api/login'>
				</head>
				<body style="font-family: sans-serif; text-align: center; padding: 50px;">
					<h2 style="color: #ef4444;">❌ Credenciales Inválidas</h2>
					<p>Email o contraseña incorrectos</p>
					<p style="color: #6b7280;">Redirigiendo...</p>
				</body>
			</html>`))
		return
	}

	// Log de login exitoso
	utils.LogAuthAttempt(email, true, clientIP)
	utils.Logger.Info("User logged in",
		zap.Uint("user_id", user.UserID),
		zap.String("email", user.Email),
		zap.String("ip", clientIP),
	)

	// Configurar cookies de forma segura
	c.setSecureCookies(ctx, token)

	// Consultar estado del arco (opcional, para mostrar al usuario)
	arcoService := services.NewArcoService()
	arcoAbierto, _ := arcoService.UltimoArcoAbiertoOCerrado()
	if arcoAbierto {
		utils.Logger.Info("User logged in with open arco",
			zap.Uint("user_id", user.UserID),
		)
	}

	// Redirigir al dashboard
	ctx.Redirect(http.StatusFound, "/movimientos")
}

// setSecureCookies configura las cookies con todos los flags de seguridad
func (c *AuthController) setSecureCookies(ctx *gin.Context, token string) {
	secure := config.AppConfig.IsProduction() // true solo en producción
	maxAge := int(config.AppConfig.SessionDuration.Seconds())

	// Configuración de cookies
	cookieConfig := &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,                    // No accesible por JavaScript
		Secure:   secure,                  // Solo HTTPS en producción
		SameSite: http.SameSiteStrictMode, // Previene CSRF
	}

	// Establecer cookie principal
	http.SetCookie(ctx.Writer, cookieConfig)

	// También establecer como 'jwt' para compatibilidad
	cookieConfig.Name = "jwt"
	http.SetCookie(ctx.Writer, cookieConfig)

	utils.Logger.Debug("Secure cookies set",
		zap.Bool("secure", secure),
		zap.Int("max_age", maxAge),
		zap.String("same_site", "Strict"),
	)
}

func (c *AuthController) Logout(ctx *gin.Context) {
	// Obtener token actual
	tokenString, _ := ctx.Cookie("session_token")
	if tokenString == "" {
		tokenString, _ = ctx.Cookie("jwt")
	}

	// Invalidar token (si está implementada la blacklist)
	if tokenString != "" {
		c.authService.InvalidateToken(tokenString)
	}

	// Obtener info del usuario antes de logout
	if userObj, exists := ctx.Get("user"); exists {
		if user, ok := userObj.(*models.User); ok {
			utils.Logger.Info("User logged out",
				zap.Uint("user_id", user.UserID),
				zap.String("email", user.Email),
			)
		}
	}

	// Borrar cookies
	c.clearCookies(ctx)

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Logout exitoso",
	})
}

// clearCookies elimina las cookies de sesión
func (c *AuthController) clearCookies(ctx *gin.Context) {
	cookieNames := []string{"session_token", "jwt"}

	for _, name := range cookieNames {
		ctx.SetCookie(
			name,
			"",
			-1, // MaxAge negativo elimina la cookie
			"/",
			"",
			config.AppConfig.IsProduction(),
			true,
		)
	}

	utils.Logger.Debug("Session cookies cleared")
}

// RefreshToken endpoint para renovar el token
func (c *AuthController) RefreshToken(ctx *gin.Context) {
	// Obtener token actual
	oldToken, err := ctx.Cookie("session_token")
	if err != nil {
		oldToken, err = ctx.Cookie("jwt")
		if err != nil {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "No hay token para renovar"})
			return
		}
	}

	// Generar nuevo token
	newToken, err := c.authService.RefreshToken(oldToken)
	if err != nil {
		utils.Logger.Warn("Token refresh failed",
			zap.Error(err),
			zap.String("ip", ctx.ClientIP()),
		)
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "No se pudo renovar el token"})
		return
	}

	// Configurar nuevas cookies
	c.setSecureCookies(ctx, newToken)

	utils.Logger.Info("Token refreshed",
		zap.String("ip", ctx.ClientIP()),
	)

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Token renovado exitosamente",
		"token":   newToken,
	})
}

// ChangePassword endpoint para cambiar contraseña
func (c *AuthController) ChangePassword(ctx *gin.Context) {
	// Obtener user_id del contexto (debe estar autenticado)
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
		return
	}

	// Obtener contraseñas del request
	type ChangePasswordRequest struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required"`
	}

	var req ChangePasswordRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Request inválido"})
		return
	}

	// Validar nueva contraseña
	if err := validators.ValidateStringLength(req.NewPassword, "nueva contraseña", 8, 128); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Cambiar contraseña
	uid, ok := userID.(uint)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno"})
		return
	}

	if err := c.authService.ChangePassword(uid, req.OldPassword, req.NewPassword); err != nil {
		utils.Logger.Warn("Password change failed",
			zap.Uint("user_id", uid),
			zap.Error(err),
		)
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	utils.Logger.Info("Password changed successfully",
		zap.Uint("user_id", uid),
	)

	// Invalidar tokens actuales (forzar re-login)
	c.clearCookies(ctx)

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Contraseña cambiada exitosamente. Por favor, inicia sesión nuevamente.",
	})
}
