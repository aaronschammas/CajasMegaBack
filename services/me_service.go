package services

import (
	"caja-fuerte/models"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetUserFromSession obtiene el usuario autenticado desde la cookie de sesión
func GetUserFromSession(r *http.Request) (*models.User, error) {
	// Implementa aquí la lógica para extraer el usuario de la sesión/cookie
	// Por ejemplo, usando JWT o sesión en memoria/DB
	// Devuelve (user, nil) si está autenticado, o (nil, error) si no
	return nil, nil // TODO: Implementar
}

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
