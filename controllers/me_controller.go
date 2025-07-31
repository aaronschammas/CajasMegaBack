package controllers

import (
	"caja-fuerte/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// MeHandler devuelve el usuario autenticado usando la cookie de sesión (versión Gin)
func MeHandler(c *gin.Context) {
	user, err := services.GetUserFromSessionGin(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	c.JSON(http.StatusOK, user)
}
