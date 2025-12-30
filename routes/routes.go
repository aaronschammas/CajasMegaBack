package routes

import (
	"caja-fuerte/config"
	"caja-fuerte/controllers"
	"caja-fuerte/middleware"
	"strings"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(cfg *config.Config) *gin.Engine {
	// Configurar modo de Gin según entorno
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// Middleware de seguridad y CORS
	r.Use(corsMiddleware(cfg))
	r.Use(securityHeadersMiddleware())
	r.Use(rateLimitMiddleware(cfg))

	// Controladores
	authController := controllers.NewAuthController()
	movementController := controllers.NewMovementController()
	arcoController := controllers.NewArcoController()

	// Archivos estáticos
	r.Static("/css", "./Front/css")
	r.Static("/js", "./Front/js")
	r.Static("/static", "./static")
	r.Static("/front", "./Front")

	// Ruta principal (redirige al login)
	r.GET("/", func(c *gin.Context) {
		c.File("./Front/index.html")
	})

	// Health check endpoint (útil para monitoreo y load balancers)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":      "ok",
			"environment": cfg.Environment,
			"version":     "1.0.0",
		})
	})

	// Rutas públicas
	public := r.Group("/api")
	{
		public.GET("/login", func(c *gin.Context) {
			c.File("./Front/index.html")
		})
		public.POST("/login", authController.Login)
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

		// Rutas de Arco
		protected.POST("/arco/abrir", arcoController.AbrirArco)
		protected.POST("/arco/cerrar", arcoController.CerrarArco)
		protected.GET("/arco/estado", controllers.ArcoEstadoHandler)
		protected.POST("/arco/abrir-avanzado", arcoController.AbrirArcoAvanzado)

		// Rutas de API
		protected.GET("/api/me", controllers.MeHandler)
		protected.GET("/api/saldo-ultimo-arco", controllers.SaldoUltimoArcoHandler)
		protected.GET("/api/arco-estado", controllers.EstadoArcoAPIHandler)
		protected.GET("/api/movimientos/arco/:arco_id", movementController.GetMovementsByArcoID)
		protected.DELETE("/api/movimientos/:movement_id", movementController.DeleteMovement)
		protected.GET("/reporte", controllers.MostrarPaginaReportes)
	}

	return r
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

// rateLimitMiddleware implementa rate limiting básico
func rateLimitMiddleware(cfg *config.Config) gin.HandlerFunc {
	// Implementación simplificada - en producción usar redis o similar
	// Por ahora solo logueamos si se alcanza el límite
	return func(c *gin.Context) {
		// TODO: Implementar rate limiting real con Redis
		// Por ahora solo pasamos la solicitud
		c.Next()
	}
}
