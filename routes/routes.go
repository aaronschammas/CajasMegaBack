package routes

import (
	"caja-fuerte/config"
	"caja-fuerte/controllers"
	"caja-fuerte/middleware"
	"strings"

	"github.com/gin-contrib/sessions"        // <-- NUEVO
	"github.com/gin-contrib/sessions/cookie" // <-- NUEVO
	"github.com/gin-gonic/gin"
	"github.com/ulule/limiter/v3"
	mgin "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/ulule/limiter/v3/drivers/store/memory"
)

func SetupRoutes(cfg *config.Config) *gin.Engine {
	// Configurar modo de Gin según entorno
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// =========================================================
	// 1. CONFIGURACIÓN DE SESIONES (Indispensable para CSRF)
	// =========================================================
	// Usamos JWTSecret como llave para firmar las cookies de sesión
	store := cookie.NewStore([]byte(cfg.JWTSecret))
	r.Use(sessions.Sessions("megacajas_session", store))

	// =========================================================
	// 2. MIDDLEWARES DE SEGURIDAD Y FILTROS
	// =========================================================
	r.Use(corsMiddleware(cfg))
	r.Use(securityHeadersMiddleware())
	r.Use(rateLimitMiddleware(cfg))

	// CSRF: Ahora funcionará correctamente porque ya existe una sesión
	if cfg.EnableCSRF && cfg.IsProduction() {
		r.Use(middleware.CSRFMiddleware(cfg.JWTSecret))
	}

	// Controladores
	authController := controllers.NewAuthController()
	movementController := controllers.NewMovementController()
	arcoController := controllers.NewArcoController()

	// Archivos estáticos (Mantenidos como respaldo de Nginx)
	r.Static("/css", "./Front/css")
	r.Static("/js", "./Front/js")
	r.Static("/static", "./static")
	r.Static("/front", "./Front")

	// Ruta principal (redirige al login)
	r.GET("/", func(c *gin.Context) {
		c.File("./Front/index.html")
	})

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":      "ok",
			"environment": cfg.Environment,
			"version":     "2.0.1",
		})
	})

	// Rutas públicas
	public := r.Group("/api")
	{
		public.GET("/login", func(c *gin.Context) {
			c.File("./Front/index.html")
		})

		loginLimiter := middleware.LoginRateLimitMiddleware()
		public.POST("/login", loginLimiter, authController.Login)

		public.GET("/register", func(c *gin.Context) {
			c.File("./Front/register.html")
		})
		public.POST("/register", loginLimiter, authController.Register)

		public.GET("/graficos", controllers.GraficosAPIHandler)
	}

	// Rutas protegidas
	protected := r.Group("")
	protected.Use(middleware.AuthMiddleware())
	{
		protected.GET("/movimientos", movementController.MovementPage)
		protected.POST("/movimientos", movementController.CreateBatch)
		protected.GET("/ingresos", movementController.IngresosPage)
		protected.GET("/egresos", movementController.EgresosPage)
		protected.GET("/ingresos/filtros", movementController.IngresosPageWithFilters)
		protected.POST("/logout", authController.Logout)
		protected.POST("/ingresos", movementController.CreateBatch)
		protected.POST("/abrir-caja", movementController.AbrirCaja)

		protected.POST("/arco/abrir", arcoController.AbrirArco)
		protected.POST("/arco/cerrar", arcoController.CerrarArco)
		protected.GET("/arco/estado", controllers.ArcoEstadoHandler)
		protected.POST("/arco/abrir-avanzado", arcoController.AbrirArcoAvanzado)

		protected.GET("/api/me", controllers.MeHandler)
		protected.GET("/api/saldo-ultimo-arco", controllers.SaldoUltimoArcoHandler)
		protected.GET("/api/arco-estado", controllers.EstadoArcoAPIHandler)
		protected.GET("/api/movimientos/arco/:arco_id", movementController.GetMovementsByArcoID)
		protected.DELETE("/api/movimientos/:movement_id", movementController.DeleteMovement)
		protected.GET("/reporte", controllers.MostrarPaginaReportes)

		//coso para todos los movimientos
		protected.GET("/historial-movimientos", movementController.HistorialMovimientosPage)

		protected.POST("/api/change-password", authController.ChangePassword)

		adminController := controllers.NewAdminController()

		// API de conceptos
		protected.GET("/registro_conceptos", adminController.ConceptosPage)

		protected.GET("/api/admin/conceptos", adminController.GetConceptos)
		protected.POST("/api/admin/conceptos", adminController.CreateConcepto)
		protected.PUT("/api/admin/conceptos/:id", adminController.UpdateConcepto)
		protected.DELETE("/api/admin/conceptos/:id", adminController.DeleteConcepto)

		// Rutas de usuarios y roles
		protected.GET("/registro_roles", adminController.RolesPage)

		protected.GET("/api/admin/usuarios", adminController.GetUsuarios)
		protected.POST("/api/admin/usuarios", adminController.CreateUsuario)
		protected.PUT("/api/admin/usuarios/:id", adminController.UpdateUsuario)
		protected.DELETE("/api/admin/usuarios/:id", adminController.DeleteUsuario)
		protected.POST("/api/admin/usuarios/:id/reset-password", adminController.ResetPasswordUsuario)

		protected.GET("/api/admin/roles", adminController.GetRoles)

		protected.POST("/api/admin/roles", adminController.CreateRole)
		protected.PUT("/api/admin/roles/:id", adminController.UpdateRole)
		protected.DELETE("/api/admin/roles/:id", adminController.DeleteRole)

	}

	return r
}

// Rate limiting
func rateLimitMiddleware(cfg *config.Config) gin.HandlerFunc {
	rate := limiter.Rate{
		Period: cfg.RateLimitDuration,
		Limit:  int64(cfg.RateLimitRequests),
	}

	store := memory.NewStore()
	instance := limiter.New(store, rate)

	middleware := mgin.NewMiddleware(instance)

	return func(c *gin.Context) {
		middleware(c)

		// Si excede el límite, loggear
		if c.IsAborted() {
			// El middleware ya abortó, solo loggeamos
			c.JSON(429, gin.H{
				"error": "Demasiadas peticiones. Intenta más tarde.",
			})
		}
	}
}

// corsMiddleware configura CORS según la configuración
func corsMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Verificar si el origen está permitido
		allowed := false
		if len(cfg.AllowedOrigins) == 1 && cfg.AllowedOrigins[0] == "*" {
			allowed = true
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		} else {
			for _, allowedOrigin := range cfg.AllowedOrigins {
				if origin == allowedOrigin {
					allowed = true
					c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
					break
				}
			}
		}

		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Headers", strings.Join(cfg.AllowedHeaders, ", "))
			c.Writer.Header().Set("Access-Control-Allow-Methods", strings.Join(cfg.AllowedMethods, ", "))
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// securityHeadersMiddleware añade headers de seguridad
func securityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevenir ataques XSS
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")
		c.Writer.Header().Set("X-Frame-Options", "DENY")
		c.Writer.Header().Set("X-XSS-Protection", "1; mode=block")

		// Política de seguridad de contenido
		c.Writer.Header().Set("Content-Security-Policy", "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com")

		// Política de referrer
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		c.Next()
	}
}
