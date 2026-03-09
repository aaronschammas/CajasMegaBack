package controllers

import (
	"caja-fuerte/middleware"
	"caja-fuerte/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// MeHandler devuelve el usuario autenticado con sus permisos
func MeHandler(c *gin.Context) {
	user, err := services.GetUserFromSessionGin(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}

	// Obtener permisos del usuario basados en su rol
	permissions, err := middleware.GetUserPermissions(user.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error obteniendo permisos"})
		return
	}

	// Convertir permisos a strings para facilitar el uso en frontend
	permissionStrings := make([]string, len(permissions))
	for i, perm := range permissions {
		permissionStrings[i] = string(perm)
	}

	// Responder con usuario y permisos
	c.JSON(http.StatusOK, gin.H{
		"user":        user,
		"permissions": permissionStrings,
		"role":        user.Role.RoleName,
	})
}
