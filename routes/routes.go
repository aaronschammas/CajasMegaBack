package routes

import (
	"caja-fuerte/config"
	"caja-fuerte/controllers"
	"caja-fuerte/middleware"
	"strings"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
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
	// CONFIGURACIÓN DE SESIONES (Indispensable para CSRF)
	// =========================================================
	store := cookie.NewStore([]byte(cfg.JWTSecret))
	r.Use(sessions.Sessions("megacajas_session", store))

	// =========================================================
	// 2. MIDDLEWARES DE SEGURIDAD Y FILTROS
	// =========================================================
	r.Use(corsMiddleware(cfg))
	r.Use(securityHeadersMiddleware())
	r.Use(rateLimitMiddleware(cfg))

	// CSRF
	if cfg.EnableCSRF && cfg.IsProduction() {
		r.Use(middleware.CSRFMiddleware(cfg.JWTSecret))
	}

	// INICIALIZAR RBAC
	middleware.InitRBAC()

	// Controladores
	authController := controllers.NewAuthController()
	movementController := controllers.NewMovementController()
	arcoController := controllers.NewArcoController()
	adminController := controllers.NewAdminController()
	alquilerController := controllers.NewAlquilerController()

	// Archivos estáticos
	r.Static("/css", "./Front/css")
	r.Static("/js", "./Front/js")
	r.Static("/static", "./static")
	r.Static("/front", "./Front")

	// Ruta principal
	r.GET("/", func(c *gin.Context) {
		c.File("./Front/index.html")
	})

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":      "ok",
			"environment": cfg.Environment,
			"version":     "2.0.2",
		})
	})

	// =========================================================
	// RUTAS PÚBLICAS (Sin autenticación)
	// =========================================================
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
	}

	// =========================================================
	// RUTAS PROTEGIDAS - REQUIEREN AUTENTICACIÓN + PERMISOS
	// =========================================================
	protected := r.Group("")
	protected.Use(middleware.AuthMiddleware()) // Verificar autenticación
	{
		// =========================================================
		// MOVIMIENTOS - Con control de permisos
		// =========================================================
		// Páginas HTML del dashboard — Gestor de Alquileres es redirigido a /alquileres
		protected.GET("/movimientos",
			middleware.RedirectGestorAlquileres(),
			movementController.MovementPage,
		)

		// ✅ Crear movimientos - Requiere permiso específico
		protected.POST("/movimientos",
			middleware.RequirePermission(middleware.PermCreateMovement),
			movementController.CreateBatch,
		)

		protected.GET("/ingresos",
			middleware.RedirectGestorAlquileres(),
			movementController.IngresosPage,
		)
		protected.GET("/egresos",
			middleware.RedirectGestorAlquileres(),
			movementController.EgresosPage,
		)

		// ✅ Crear ingresos - Requiere permiso específico
		protected.POST("/ingresos",
			middleware.RequirePermission(middleware.PermCreateMovement),
			movementController.CreateBatch,
		)

		protected.POST("/abrir-caja", movementController.AbrirCaja)
		protected.GET("/historial_movimientos", movementController.HistorialMovimientosPage)

		// =========================================================
		// ARCO - Control de apertura/cierre de caja
		// =========================================================
		// ✅ Abrir arco - Permite a usuarios abrir su propia caja
		protected.POST("/arco/abrir",
			middleware.RequirePermission(middleware.PermOpenArco, middleware.PermOpenOwnArco),
			arcoController.AbrirArco,
		)

		// ✅ Cerrar arco - Requiere permiso de cierre
		protected.POST("/arco/cerrar",
			middleware.RequirePermission(middleware.PermCloseArco),
			arcoController.CerrarArco,
		)

		// ✅ CORREGIDO: Proteger endpoint de estado con permisos
		protected.GET("/arco/estado",
			middleware.RequirePermission(middleware.PermReadArco),
			controllers.ArcoEstadoHandler,
		)

		// ✅ Arco avanzado/global - SOLO Admin General
		protected.POST("/arco/abrir-avanzado",
			middleware.RequirePermission(middleware.PermOpenGlobalArco),
			arcoController.AbrirArcoAvanzado,
		)

		// =========================================================
		// API DE DATOS - PROTEGIDAS CON RBAC
		// =========================================================
		protected.GET("/api/me", controllers.MeHandler)

		// ✅ CORREGIDO: Proteger endpoint de saldo con permisos
		protected.GET("/api/saldo-ultimo-arco",
			middleware.RequirePermission(middleware.PermReadArco),
			controllers.SaldoUltimoArcoHandler,
		)

		protected.GET("/api/arco-estado",
			middleware.RequirePermission(middleware.PermReadArco),
			controllers.ArcoEstadoHandler,
		)

		// leer movimientos - Requiere permiso de lectura
		protected.GET("/api/movimientos/arco/:arco_id",
			middleware.RequirePermission(middleware.PermReadMovement, middleware.PermReadOwnMovement),
			movementController.GetMovementsByArcoID,
		)

		// Eliminar movimientos - SOLO Supervisor y Admin General
		protected.DELETE("/api/movimientos/:movement_id",
			middleware.RequirePermission(middleware.PermDeleteMovement),
			movementController.DeleteMovement,
		)

		// =========================================================
		// REPORTES - Con control de acceso
		// =========================================================
		//  Reportes personales - Usuarios pueden ver sus reportes
		protected.GET("/reporte",
			middleware.RequirePermission(middleware.PermViewReports, middleware.PermViewOwnReports),
			controllers.MostrarPaginaReportes,
		)

		// Reporte general/global - SOLO Admin General
		protected.GET("/reporte_general",
			middleware.RequirePermission(middleware.PermViewGlobalCaja),
			controllers.MostrarPaginaReporteGlobal,
		)

		// =========================================================
		// MÓDULO DE ALQUILERES
		// Ruta oculta — accesible solo para Gestor de Alquileres y Admin General
		// =========================================================

		// Página principal del módulo
		protected.GET("/alquileres",
			middleware.RequirePermission(middleware.PermViewAlquileres),
			alquilerController.AlquileresPage,
		)

		// API CRUD propiedades
		protected.GET("/api/alquileres/propiedades",
			middleware.RequirePermission(middleware.PermViewAlquileres),
			alquilerController.GetPropiedades,
		)
		protected.GET("/api/alquileres/propiedades/:id",
			middleware.RequirePermission(middleware.PermViewAlquileres),
			alquilerController.GetPropiedadByID,
		)
		protected.POST("/api/alquileres/propiedades",
			middleware.RequirePermission(middleware.PermManageAlquileres),
			alquilerController.CrearPropiedad,
		)
		protected.PUT("/api/alquileres/propiedades/:id",
			middleware.RequirePermission(middleware.PermManageAlquileres),
			alquilerController.ActualizarPropiedad,
		)
		protected.DELETE("/api/alquileres/propiedades/:id",
			middleware.RequirePermission(middleware.PermManageAlquileres),
			alquilerController.EliminarPropiedad,
		)
		protected.DELETE("/api/alquileres/propiedades/:id/metadata/:campo",
			middleware.RequirePermission(middleware.PermManageAlquileres),
			alquilerController.EliminarMetadataField,
		)

		// API Pagos
		protected.POST("/api/alquileres/propiedades/:id/pago",
			middleware.RequirePermission(middleware.PermRegistrarPago),
			alquilerController.RegistrarPago,
		)
		protected.DELETE("/api/alquileres/propiedades/:id/pago/:mes",
			middleware.RequirePermission(middleware.PermManageAlquileres),
			alquilerController.DeshacerPago,
		)

		// API Resumen / Reportes (solo Admin General)
		protected.GET("/api/alquileres/resumen",
			middleware.RequirePermission(middleware.PermViewAlquileres),
			alquilerController.GetResumen,
		)
		protected.GET("/api/alquileres/resumen/movimientos",
			middleware.RequirePermission(middleware.PermViewAlquilerReport),
			alquilerController.GetResumenMovimientos,
		)
		protected.POST("/api/alquileres/actualizar-morosos",
			middleware.RequirePermission(middleware.PermManageAlquileres),
			alquilerController.ActualizarMorosos,
		)

		// Notificaciones de actualización de monto por IPC
		protected.GET("/api/alquileres/actualizaciones-pendientes",
			middleware.RequirePermission(middleware.PermViewAlquileres),
			alquilerController.GetActualizacionesPendientes,
		)
		protected.PUT("/api/alquileres/propiedades/:id/actualizar-monto",
			middleware.RequirePermission(middleware.PermManageAlquileres),
			alquilerController.ActualizarMonto,
		)
		protected.POST("/api/alquileres/propiedades/:id/posponer",
			middleware.RequirePermission(middleware.PermViewAlquileres),
			alquilerController.PosponerActualizacion,
		)

		// =========================================================
		// AUTH
		// =========================================================
		protected.POST("/logout", authController.Logout)
		protected.POST("/api/change-password", authController.ChangePassword)

		// =========================================================
		// ADMINISTRACIÓN - PÁGINAS HTML
		//  SOLO Admin General puede acceder a estas páginas
		// =========================================================
		admin := protected.Group("")
		admin.Use(middleware.RequireRole("Administrador General"))
		{
			admin.GET("/registro_conceptos", adminController.ConceptosPage)
			admin.GET("/registro_usuarios", adminController.UsuariosPage)
			admin.GET("/registro_roles", adminController.RolesPage)
		}

		// =========================================================
		// API DE ADMINISTRACIÓN - Con permisos granulares
		// =========================================================

		// API de conceptos
		//  Listar conceptos - Todos pueden ver
		protected.GET("/api/admin/conceptos", adminController.GetConceptos)

		//  Crear concepto - Supervisor y Admin General
		protected.POST("/api/admin/conceptos",
			middleware.RequirePermission(middleware.PermManageConcepts),
			adminController.CreateConcepto,
		)

		//  Actualizar concepto - Supervisor y Admin General
		protected.PUT("/api/admin/conceptos/:id",
			middleware.RequirePermission(middleware.PermManageConcepts),
			adminController.UpdateConcepto,
		)

		//  Eliminar concepto - Supervisor y Admin General
		protected.DELETE("/api/admin/conceptos/:id",
			middleware.RequirePermission(middleware.PermManageConcepts),
			adminController.DeleteConcepto,
		)

		// API de usuarios - SOLO Admin General
		//  Listar usuarios
		protected.GET("/api/admin/usuarios",
			middleware.RequirePermission(middleware.PermManageUsers),
			adminController.GetUsuarios,
		)

		//  Crear usuario
		protected.POST("/api/admin/usuarios",
			middleware.RequirePermission(middleware.PermManageUsers),
			adminController.CreateUsuario,
		)

		//  Actualizar usuario
		protected.PUT("/api/admin/usuarios/:id",
			middleware.RequirePermission(middleware.PermManageUsers),
			adminController.UpdateUsuario,
		)

		//  Eliminar usuario
		protected.DELETE("/api/admin/usuarios/:id",
			middleware.RequirePermission(middleware.PermManageUsers),
			adminController.DeleteUsuario,
		)

		//  Resetear contraseña
		protected.POST("/api/admin/usuarios/:id/reset-password",
			middleware.RequirePermission(middleware.PermManageUsers),
			adminController.ResetPasswordUsuario,
		)

		// API de roles - SOLO Admin General
		//  Listar roles
		protected.GET("/api/admin/roles",
			middleware.RequirePermission(middleware.PermManageRoles),
			adminController.GetRoles,
		)

		//  Crear rol
		protected.POST("/api/admin/roles",
			middleware.RequirePermission(middleware.PermManageRoles),
			adminController.CreateRole,
		)

		//  Actualizar rol
		protected.PUT("/api/admin/roles/:id",
			middleware.RequirePermission(middleware.PermManageRoles),
			adminController.UpdateRole,
		)

		//  Eliminar rol
		protected.DELETE("/api/admin/roles/:id",
			middleware.RequirePermission(middleware.PermManageRoles),
			adminController.DeleteRole,
		)
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

		if c.IsAborted() {
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
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")
		c.Writer.Header().Set("X-Frame-Options", "DENY")
		c.Writer.Header().Set("X-XSS-Protection", "1; mode=block")
		c.Writer.Header().Set("Content-Security-Policy", "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com")
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		c.Next()
	}
}
