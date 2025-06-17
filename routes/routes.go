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
			// Devuelve el HTML del login (útil si quieres servirlo desde backend)
			c.File("./Front/index.html")
		})
		public.POST("/login", authController.Login) //
	}

	// Rutas protegidas
	protected := r.Group("")                   //
	protected.Use(middleware.AuthMiddleware()) //
	{
		protected.GET("/movimientos", movementController.MovementPage)
		protected.GET("/ingresos", movementController.IngresosPage)
		protected.POST("/logout", authController.Logout)                          //
		protected.POST("/ingresos", movementController.CreateBatch)               //
		protected.GET("/api/movements", movementController.GetMovements)          //
		protected.GET("/api/movements/last", movementController.GetLastMovements) //

	}

	return r //
}
