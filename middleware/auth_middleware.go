package middleware

import (
	"caja-fuerte/models"
	"caja-fuerte/services" //
	"fmt"
	"net/http" //
	"strconv"  //
	"strings"  //

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

		// 2. Si no hay token en el header, buscar en la cookie (soporta 'session_token' y 'jwt')
		if tokenString == "" {
			cookie, err := c.Cookie("session_token")
			if err == nil {
				tokenString = cookie
			}
		}
		if tokenString == "" {
			cookie, err := c.Cookie("jwt")
			if err == nil {
				tokenString = cookie
			}
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

		// Guardar claims en el contexto (asegura que user_id sea uint y no string)
		userIDRaw := (*claims)["user_id"]
		var userID uint
		switch v := userIDRaw.(type) {
		case float64:
			userID = uint(v)
		case int:
			userID = uint(v)
		case int64:
			userID = uint(v)
		case uint:
			userID = v
		case uint64:
			userID = uint(v)
		case string:
			parsed, err := strconv.ParseUint(v, 10, 64)
			if err == nil {
				userID = uint(parsed)
			}
		}
		fmt.Println("[MIDDLEWARE] user_id claim extraído del token:", userIDRaw, "-> user_id usado:", userID)

		// Buscar el usuario en la base de datos y guardarlo en el contexto
		var user models.User
		err = authService.GetUserByID(userID, &user)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no encontrado"})
			c.Abort()
			return
		}
		c.Set("user", &user)
		c.Set("user_id", userID)
		c.Set("email", user.Email)
		c.Set("role_id", user.RoleID)

		c.Next() //
	}
}
