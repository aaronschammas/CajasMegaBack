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
		tokenString := "" //

		// 1. Intentar obtener el token del header Authorization
		authHeader := c.GetHeader("Authorization") //
		if authHeader != "" {                      //
			tokenString = strings.Replace(authHeader, "Bearer ", "", 1) //
		} //

		// 2. Si no hay token en el header, buscar en la cookie
		if tokenString == "" { //
			cookie, err := c.Cookie("session_token") //
			if err == nil {                          //
				tokenString = cookie //
			} //
		} //

		if tokenString == "" { //
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token de autorización requerido"}) //
			c.Abort()                                                                          //
			return                                                                             //
		} //

		claims, err := authService.ValidateToken(tokenString) //
		if err != nil {                                       //
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token inválido"}) //
			c.Abort()                                                         //
			return                                                            //
		} //

		// Guardar claims en el contexto
		c.Set("user_id", (*claims)["user_id"]) //
		c.Set("email", (*claims)["email"])     //
		c.Set("role_id", (*claims)["role_id"]) //

		c.Next() //
	}
}
