package services

import (
	"caja-fuerte/database"
	"caja-fuerte/models"
)

// GetArcoAbierto obtiene el último arco (por ID más alto) y verifica si está abierto (sin importar el usuario)
func GetArcoAbierto(_ uint) (*models.Arco, bool) {
	var arco models.Arco
	err := database.DB.Order("id DESC").First(&arco).Error
	if err != nil {
		return nil, false
	}
	if arco.Activo {
		return &arco, true
	}
	return &arco, false
}
