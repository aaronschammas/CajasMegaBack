package controllers

import (
	"caja-fuerte/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// conceptService es usado por movement_controller.go para obtener conceptos en las páginas HTML
var conceptService = services.NewConceptService()

// GetConcepts devuelve los conceptos activos en formato JSON
func GetConcepts(ctx *gin.Context) {
	concepts, err := conceptService.GetActiveConcepts()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener conceptos"})
		return
	}
	ctx.JSON(http.StatusOK, concepts)
}
