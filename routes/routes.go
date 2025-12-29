package routes

import (
	"caja-fuerte/controllers" //
	"caja-fuerte/middleware"  //

	"github.com/gin-gonic/gin" //
)

func SetupRoutes() *gin.Engine { //
	r := gin.Default() //

	// CORS middleware
	r.Use(func(c *gin.Context) { //
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")                                                                                                                            //
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")                                                                                                                    //
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With") //
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")                                                                                             //

		if c.Request.Method == "OPTIONS" { //
			c.AbortWithStatus(204) //
			return                 //
		}

		c.Next() //
	})

	// Controladores
	authController := controllers.NewAuthController()         //
	movementController := controllers.NewMovementController() //
	arcoController := controllers.NewArcoController()         //
	//Archivo estáticos
	r.Static("/css", "./Front/css")
	r.Static("/js", "./Front/js")
	r.Static("/static", "./static")
	r.Static("/front", "./Front")

	// Ruta principal (redirige al nuevo front)
	r.GET("/", func(c *gin.Context) {
		c.File("./Front/index.html")
	})

	// Rutas públicas
	public := r.Group("/api") //
	{
		public.GET("/login", func(c *gin.Context) {
			// Devuelve el HTML del login
			c.File("./Front/index.html")
		})
		public.POST("/login", authController.Login) //
		// Endpoint público para obtener usuario autenticado (protegido por middleware en la práctica)
		public.GET("/graficos", controllers.GraficosAPIHandler) // <-- NUEVO ENDPOINT
	}

	// Rutas protegidas
	protected := r.Group("")                   //
	protected.Use(middleware.AuthMiddleware()) //
	{
		protected.GET("/movimientos", movementController.MovementPage)

		protected.POST("/movimientos", movementController.CreateBatch)

		protected.GET("/ingresos", movementController.IngresosPage)
		protected.GET("/egresos", movementController.EgresosPage)
		protected.GET("/ingresos/filtros", movementController.IngresosPageWithFilters)
		protected.POST("/logout", authController.Logout)
		protected.POST("/ingresos", movementController.CreateBatch)
		protected.POST("/abrir-caja", movementController.AbrirCaja)
		//RUTAS DE ARCO
		protected.POST("/arco/abrir", arcoController.AbrirArco)
		protected.POST("/arco/cerrar", arcoController.CerrarArco)
		protected.GET("/arco/estado", controllers.ArcoEstadoHandler) // Nuevo endpoint REST adaptado a Gin
		protected.POST("/arco/abrir-avanzado", arcoController.AbrirArcoAvanzado)
		protected.GET("/api/me", controllers.MeHandler) // Nuevo endpoint REST
		protected.GET("/api/saldo-ultimo-arco", controllers.SaldoUltimoArcoHandler)
		protected.GET("/api/arco-estado", controllers.EstadoArcoAPIHandler)
		// Endpoint para obtener movimientos por arcoID
		protected.GET("/api/movimientos/arco/:arco_id", movementController.GetMovementsByArcoID)
		// Endpoint para eliminar (soft-delete) un movimiento
		protected.DELETE("/api/movimientos/:movement_id", movementController.DeleteMovement)
		protected.GET("/reporte", controllers.MostrarPaginaReportes)
	}

	return r //
}
