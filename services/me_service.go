package services

import (
	"caja-fuerte/models"
	"errors"

	"github.com/gin-gonic/gin"
)

// GetUserFromSessionGin obtiene el usuario autenticado desde el contexto Gin
func GetUserFromSessionGin(c *gin.Context) (*models.User, error) {
	userObj, exists := c.Get("user")
	if !exists {
		return nil, errors.New("No autenticado")
	}
	user, ok := userObj.(*models.User)
	if !ok {
		return nil, errors.New("No autenticado")
	}
	return user, nil
}
