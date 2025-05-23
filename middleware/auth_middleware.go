package middleware

import (
	"caja-fuerte/services" //
	"net/http"             //
	"strings"              //

	"github.com/gin-gonic/gin" //
)

func AuthMiddleware() gin.HandlerFunc { //
	authService := services.NewAuthService() //

	return func(c *gin.Context) { //
		authHeader := c.GetHeader("Authorization") //
		if authHeader == "" {                      //
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token de autorización requerido"}) //
			c.Abort()                                                                          //
			return                                                                             //
		}

		tokenString := strings.Replace(authHeader, "Bearer ", "", 1) //
		claims, err := authService.ValidateToken(tokenString)        //
		if err != nil {                                              //
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token inválido"}) //
			c.Abort()                                                         //
			return                                                            //
		}

		// Guardar claims en el contexto
		c.Set("user_id", (*claims)["user_id"]) //
		c.Set("email", (*claims)["email"])     //
		c.Set("role_id", (*claims)["role_id"]) //

		c.Next() //
	}
}
