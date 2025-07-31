package controllers

import (
	"caja-fuerte/services"
)

// Verifica el estado del último arco global (sin importar usuario, turno ni fecha)
// Devuelve true si hay que cerrar el último arco antes de abrir uno nuevo, false si se puede abrir uno nuevo directamente
func CheckUltimoArco() (bool, error) {
	arcoService := services.NewArcoService()
	return arcoService.UltimoArcoAbiertoOCerrado()
}
