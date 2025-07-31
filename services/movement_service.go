package services

import (
	"caja-fuerte/database" //
	"caja-fuerte/models"   //
	"errors"               //
	"fmt"                  //
	"time"                 //

	"gorm.io/gorm" //
)

type MovementService struct{} //

func NewMovementService() *MovementService { //
	return &MovementService{} //
}

func (s *MovementService) CreateBatchMovements(movements []models.MovementRequest) error { //
	return database.DB.Transaction(func(tx *gorm.DB) error { //
		for _, movReq := range movements { //
			// --- Validar que hay un arco abierto para el usuario y turno ---
			arco, err := getArcoForMovement(tx, movReq.CreatedBy, movReq.Shift)
			if err != nil {
				return err // No hay arco abierto o error
			}
			// Generar reference_id
			referenceID, err := s.generateReferenceID(tx, movReq.CreatedBy) // Pasamos tx para el contador
			if err != nil {                                                 //
				return err //
			}

			movement := models.Movement{ //
				ReferenceID:  referenceID,         //
				MovementType: movReq.MovementType, //
				MovementDate: time.Now(),          // // Opcionalmente, tomar de movReq si el cliente la envía
				Amount:       movReq.Amount,       //
				Shift:        movReq.Shift,        //
				ConceptID:    movReq.ConceptID,    //
				Details:      movReq.Details,      //
				CreatedBy:    movReq.CreatedBy,    //
				ArcoID:       arco.ID,             // Asociar movimiento al arco abierto
			}

			if err := tx.Create(&movement).Error; err != nil { //
				return err //
			}

			// Crear registro específico según el tipo
			if movReq.MovementType == "Ingreso" { //
				specificIncome := models.SpecificIncome{MovementID: movement.MovementID} //
				if err := tx.Create(&specificIncome).Error; err != nil {                 //
					return err //
				}
			} else { //
				specificExpense := models.SpecificExpense{MovementID: movement.MovementID} //
				if err := tx.Create(&specificExpense).Error; err != nil {                  //
					return err //
				}
			}
		}
		return nil //
	})
}

// generateReferenceID AHORA TOMA *gorm.DB (tx) para la transacción
// ¡ESTA FUNCIÓN NECESITA SER REVISADA PARA UN CONTADOR GLOBAL ATÓMICO Y ROBUSTO!
// La implementación actual es un contador diario y NO es segura para concurrencia.
func (s *MovementService) generateReferenceID(tx *gorm.DB, userID uint) (string, error) { //
	// Formato: YYYYMMDD-ContadorDelDia-UserID
	now := time.Now()                 //
	dateStr := now.Format("20060102") //

	var count int64 //
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	todayEnd := todayStart.Add(24 * time.Hour)

	// Usar tx para que la cuenta sea parte de la misma transacción que la inserción del movimiento
	if err := tx.Model(&models.Movement{}).Where("created_at >= ? AND created_at < ?", todayStart, todayEnd).Count(&count).Error; err != nil {
		// No necesariamente retornar err aquí, podría ser 0 si no hay movimientos aún hoy
		// Pero si hay un error de DB real, sí.
		// Por simplicidad en el ejemplo, lo mantenemos, pero esto debe ser robusto.
		return "", err
	}

	return fmt.Sprintf("%s-%d-%d", dateStr, count+1, userID), nil //
}

func (s *MovementService) GetMovements(filters map[string]interface{}, limit, offset int) ([]models.Movement, int64, error) { //
	var movements []models.Movement //
	var total int64                 //

	query := database.DB.Model(&models.Movement{}). //
							Preload("Concept").         //
							Preload("Creator").         //
							Where("deleted_at IS NULL") //

	// Aplicar filtros
	if date, ok := filters["date"]; ok { //
		query = query.Where("DATE(movement_date) = ?", date) //
	}
	if userID, ok := filters["user_id"]; ok { //
		query = query.Where("created_by = ?", userID) //
	}
	if shift, ok := filters["shift"]; ok { //
		query = query.Where("shift = ?", shift) //
	}
	if conceptID, ok := filters["concept_id"]; ok { //
		query = query.Where("concept_id = ?", conceptID) //
	}
	if arcoID, ok := filters["arco_id"]; ok && arcoID != 0 {
		query = query.Where("arco_id = ?", arcoID)
	}

	// Contar total
	if err := query.Count(&total).Error; err != nil { // Modificado para capturar error del Count
		return nil, 0, err
	}

	// Obtener resultados con paginación
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&movements).Error //

	return movements, total, err //
}

func (s *MovementService) GetLastMovements(limit int) ([]models.Movement, error) { //
	var movements []models.Movement //
	err := database.DB.             //
					Preload("Concept").          //
					Preload("Creator").          //
					Where("deleted_at IS NULL"). //
					Order("created_at DESC").    //
					Limit(limit).                //
					Find(&movements).Error       //

	return movements, err //
}

func (s *MovementService) UpdateMovement(id uint, updates map[string]interface{}, updatedBy uint) error { //
	updates["updated_by"] = updatedBy  //
	updates["updated_at"] = time.Now() //

	return database.DB.Model(&models.Movement{}).Where("movement_id = ?", id).Updates(updates).Error //
}

func (s *MovementService) SoftDeleteMovement(id uint, deletedBy uint) error { //
	updates := map[string]interface{}{ //
		"deleted_by": deletedBy,  //
		"deleted_at": time.Now(), //
	}

	return database.DB.Model(&models.Movement{}).Where("movement_id = ?", id).Updates(updates).Error //
}

func (s *MovementService) GetMovementsWithFilters(filters map[string]interface{}) ([]models.Movement, int64, error) {
	var movements []models.Movement
	var total int64

	query := database.DB.Model(&models.Movement{}).
		Preload("Concept").
		Preload("Creator").
		Where("deleted_at IS NULL")

	// Filtros avanzados
	if t, ok := filters["movement_type"]; ok && t != "" {
		query = query.Where("movement_type = ?", t)
	}
	if dgte, ok := filters["date_gte"]; ok {
		query = query.Where("movement_date >= ?", dgte)
	}
	if dlt, ok := filters["date_lt"]; ok {
		query = query.Where("movement_date < ?", dlt)
	}
	if user, ok := filters["user_id"]; ok && user != "" {
		query = query.Where("created_by = ?", user)
	}
	if shift, ok := filters["shift"]; ok && shift != "" {
		query = query.Where("shift = ?", shift)
	}
	if concept, ok := filters["concept_id"]; ok && concept != "" {
		query = query.Where("concept_id = ?", concept)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("created_at DESC").Find(&movements).Error; err != nil {
		return nil, 0, err
	}
	return movements, total, nil
}

// --- Helper para validar arco abierto ---
func getArcoForMovement(tx *gorm.DB, userID uint, turno string) (*models.Arco, error) {
	var arco models.Arco
	err := tx.Where("created_by = ? AND turno = ? AND activo = ?", userID, turno, true).
		Order("id DESC").
		First(&arco).Error
	if err != nil {
		return nil, errors.New("No hay un arco abierto para este turno. Debe abrir el arco antes de crear movimientos.")
	}
	return &arco, nil
}
