package controllers

import (
	"caja-fuerte/models"
	"caja-fuerte/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

type ConceptController struct{}

func NewConceptController() *ConceptController {
	return &ConceptController{}
}

var conceptService = services.NewConceptService()

// GET /api/concepts (API JSON)
func (c *ConceptController) GetConcepts(ctx *gin.Context) {
	concepts, err := conceptService.GetActiveConcepts()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener conceptos"})
		return
	}
	ctx.JSON(http.StatusOK, concepts)
}

// Para HTML: retorna conceptos como variable para template
func (c *ConceptController) GetConceptsForHTML() ([]models.ConceptType, error) {
	return conceptService.GetActiveConcepts()
}
