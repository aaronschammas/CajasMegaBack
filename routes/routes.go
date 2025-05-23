package routes

import (
	"caja-fuerte/controllers" //
	"caja-fuerte/middleware"  //
	"net/http"                //

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

	// Rutas públicas
	public := r.Group("/api") //
	{
		public.POST("/login", authController.Login) //
	}

	// Rutas protegidas
	protected := r.Group("/api")               //
	protected.Use(middleware.AuthMiddleware()) //
	{
		protected.POST("/logout", authController.Logout)                      //
		protected.POST("/movements/batch", movementController.CreateBatch)    //
		protected.GET("/movements", movementController.GetMovements)          //
		protected.GET("/movements/last", movementController.GetLastMovements) //
	}

	// Servir archivos estáticos (HTML)
	r.Static("/static", "./static") //
	r.LoadHTMLGlob("templates/*")   //

	// Ruta principal
	r.GET("/", func(c *gin.Context) { //
		c.HTML(http.StatusOK, "index.html", nil) //
	})

	return r //
}
