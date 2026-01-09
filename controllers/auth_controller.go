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

		// Redirigir de vuelta al login con error en query param
		ctx.Redirect(http.StatusFound, "/api/login?error="+err.Error())
		return
	}

	// Sanitizar email
	email, _ = validators.ValidateAndSanitizeEmail(email)

	// Intentar autenticación
	token, user, err := c.authService.Login(email, password)
	if err != nil {
		// Log de intento fallido
		utils.LogAuthAttempt(email, false, clientIP)

		// Redirigir de vuelta al login con error
		ctx.Redirect(http.StatusFound, "/api/login?error=Credenciales+invalidas")
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

	// Redirigir al dashboard
	ctx.Redirect(http.StatusFound, "/movimientos")
}

// Register - Registro de usuarios
func (c *AuthController) Register(ctx *gin.Context) {
	// Si es GET, mostrar página de registro
	if ctx.Request.Method == "GET" {
		ctx.File("./Front/register.html")
		return
	}

	// POST: Procesar registro
	email := ctx.PostForm("email")
	password := ctx.PostForm("password")
	confirmPassword := ctx.PostForm("confirm_password")
	fullName := ctx.PostForm("full_name")
	clientIP := ctx.ClientIP()

	// Validar que las contraseñas coincidan
	if password != confirmPassword {
		ctx.Redirect(http.StatusFound, "/api/register?error=Las+contraseñas+no+coinciden")
		return
	}

	// Validar inputs
	if err := validators.ValidateLoginRequest(email, password); err != nil {
		utils.Logger.Warn("Invalid registration attempt",
			zap.String("email", email),
			zap.String("ip", clientIP),
			zap.Error(err),
		)

		ctx.Redirect(http.StatusFound, "/api/register?error="+err.Error())
		return
	}

	// Validar nombre completo
	if fullName == "" {
		ctx.Redirect(http.StatusFound, "/api/register?error=El+nombre+completo+es+requerido")
		return
	}

	// Sanitizar email
	email, _ = validators.ValidateAndSanitizeEmail(email)

	// Sanitizar nombre
	fullName = validators.SanitizeString(fullName)

	// Intentar crear usuario
	user, err := c.authService.Register(email, password, fullName)
	if err != nil {
		utils.Logger.Warn("Registration failed",
			zap.String("email", email),
			zap.String("ip", clientIP),
			zap.Error(err),
		)

		ctx.Redirect(http.StatusFound, "/api/register?error="+err.Error())
		return
	}

	// Log de registro exitoso
	utils.Logger.Info("New user registered",
		zap.Uint("user_id", user.UserID),
		zap.String("email", user.Email),
		zap.String("ip", clientIP),
	)

	// Redirigir al login con mensaje de éxito
	ctx.Redirect(http.StatusFound, "/api/login?success=Registro+exitoso")
}

// setSecureCookies configura las cookies con todos los flags de seguridad
func (c *AuthController) setSecureCookies(ctx *gin.Context, token string) {
	secure := config.AppConfig.IsProduction()
	maxAge := int(config.AppConfig.SessionDuration.Seconds())

	cookieConfig := &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	}

	http.SetCookie(ctx.Writer, cookieConfig)

	cookieConfig.Name = "jwt"
	http.SetCookie(ctx.Writer, cookieConfig)

	utils.Logger.Debug("Secure cookies set",
		zap.Bool("secure", secure),
		zap.Int("max_age", maxAge),
		zap.String("same_site", "Strict"),
	)
}

func (c *AuthController) Logout(ctx *gin.Context) {
	tokenString, _ := ctx.Cookie("session_token")
	if tokenString == "" {
		tokenString, _ = ctx.Cookie("jwt")
	}

	if tokenString != "" {
		c.authService.InvalidateToken(tokenString)
	}

	if userObj, exists := ctx.Get("user"); exists {
		if user, ok := userObj.(*models.User); ok {
			utils.Logger.Info("User logged out",
				zap.Uint("user_id", user.UserID),
				zap.String("email", user.Email),
			)
		}
	}

	c.clearCookies(ctx)

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Logout exitoso",
	})
}

func (c *AuthController) clearCookies(ctx *gin.Context) {
	cookieNames := []string{"session_token", "jwt"}

	for _, name := range cookieNames {
		ctx.SetCookie(
			name,
			"",
			-1,
			"/",
			"",
			config.AppConfig.IsProduction(),
			true,
		)
	}

	utils.Logger.Debug("Session cookies cleared")
}

func (c *AuthController) RefreshToken(ctx *gin.Context) {
	oldToken, err := ctx.Cookie("session_token")
	if err != nil {
		oldToken, err = ctx.Cookie("jwt")
		if err != nil {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "No hay token para renovar"})
			return
		}
	}

	newToken, err := c.authService.RefreshToken(oldToken)
	if err != nil {
		utils.Logger.Warn("Token refresh failed",
			zap.Error(err),
			zap.String("ip", ctx.ClientIP()),
		)
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "No se pudo renovar el token"})
		return
	}

	c.setSecureCookies(ctx, newToken)

	utils.Logger.Info("Token refreshed",
		zap.String("ip", ctx.ClientIP()),
	)

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Token renovado exitosamente",
		"token":   newToken,
	})
}

func (c *AuthController) ChangePassword(ctx *gin.Context) {
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
		return
	}

	type ChangePasswordRequest struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required"`
	}

	var req ChangePasswordRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Request inválido"})
		return
	}

	if err := validators.ValidateStringLength(req.NewPassword, "nueva contraseña", 8, 128); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

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

	c.clearCookies(ctx)

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Contraseña cambiada exitosamente. Por favor, inicia sesión nuevamente.",
	})
}
