package controllers

import (
	"caja-fuerte/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ArcoEstadoHandler devuelve el estado del arco abierto para el usuario autenticado (versión Gin)
func ArcoEstadoHandler(c *gin.Context) {
	user, err := services.GetUserFromSessionGin(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	arco, abierto := services.GetArcoAbierto(user.UserID)
	c.JSON(http.StatusOK, gin.H{
		"arco_abierto": abierto,
		"arco":         arco,
	})
}
