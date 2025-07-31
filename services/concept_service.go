package services

import (
	"caja-fuerte/database"
	"caja-fuerte/models"
)

type ConceptService struct{}

func NewConceptService() *ConceptService {
	return &ConceptService{}
}

func (s *ConceptService) GetActiveConcepts() ([]models.ConceptType, error) {
	var concepts []models.ConceptType
	db := database.DB
	if err := db.Where("is_active = ?", true).Find(&concepts).Error; err != nil {
		return nil, err
	}
	return concepts, nil
}

func (s *ConceptService) GetActiveConceptsByType(tipo string) ([]models.ConceptType, error) {
	var concepts []models.ConceptType
	db := database.DB
	if err := db.Where("is_active = ? AND movement_type_association IN (?, 'Ambos')", true, tipo).Find(&concepts).Error; err != nil {
		return nil, err
	}
	return concepts, nil
}
