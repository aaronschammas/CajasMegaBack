package services

import (
	"caja-fuerte/database" //
	"caja-fuerte/models"   //
	"errors"               //
	"fmt"                  //
	"strings"

	//
	"time" //

	"gorm.io/gorm" //
)

type MovementService struct{} //

func NewMovementService() *MovementService { //
	return &MovementService{} //
}

// Errores exportados para permitir manejo específico en los controllers
var (
	ErrNoOpenArco     = errors.New("no open arco for user/turn")
	ErrFKConstraint   = errors.New("foreign key constraint")
	ErrValidation     = errors.New("validation error")
	ErrCreateMovement = errors.New("create movement error")
)

func (s *MovementService) CreateBatchMovements(movements []models.MovementRequest) error { //
	return database.DB.Transaction(func(tx *gorm.DB) error { //
		for _, movReq := range movements { //
			// Validaciones básicas antes de intentar insertar
			if movReq.Amount <= 0 {
				return fmt.Errorf("%w: amount must be > 0", ErrValidation)
			}
			if movReq.Shift != "M" && movReq.Shift != "T" {
				return fmt.Errorf("%w: invalid shift '%s'", ErrValidation, movReq.Shift)
			}

			// Si es un RetiroCaja, forzar el concepto y concept_id a 4
			if movReq.MovementType == "RetiroCaja" {
				movReq.ConceptID = 4
			}

			// --- Validar que hay un arco abierto para el usuario y turno ---
			arco, err := getArcoForMovement(tx, movReq.CreatedBy, movReq.Shift)
			if err != nil {
				// envolver el error con el sentinel para que el controller lo interprete
				return fmt.Errorf("%w: %s", ErrNoOpenArco, err.Error())
			}
			// Generar reference_id
			referenceID, err := s.generateReferenceID(tx, movReq.CreatedBy) // Pasamos tx para el contador
			if err != nil {                                                 //
				return fmt.Errorf("%w: %s", ErrCreateMovement, err.Error())
			}

			movement := models.Movement{ //
				ReferenceID:  referenceID,         //
				MovementType: movReq.MovementType, //
				MovementDate: time.Now(),          // //
				Amount:       movReq.Amount,       //
				Shift:        movReq.Shift,        //
				ConceptID:    movReq.ConceptID,    //
				Details:      movReq.Details,      //
				CreatedBy:    movReq.CreatedBy,    //
				ArcoID:       arco.ID,             // Asociar movimiento al arco abierto
			}

			if err := tx.Create(&movement).Error; err != nil { //
				// detectar constraint de FK
				if strings.Contains(strings.ToLower(err.Error()), "foreign key") || strings.Contains(err.Error(), "1452") {
					return fmt.Errorf("%w: %s", ErrFKConstraint, err.Error())
				}
				return fmt.Errorf("%w: %s", ErrCreateMovement, err.Error()) //
			}

			// Crear registro específico según el tipo
			if movReq.MovementType == "Ingreso" { //
				specificIncome := models.SpecificIncome{MovementID: movement.MovementID} //
				if err := tx.Create(&specificIncome).Error; err != nil {                 //
					if strings.Contains(strings.ToLower(err.Error()), "foreign key") || strings.Contains(err.Error(), "1452") {
						return fmt.Errorf("%w: %s", ErrFKConstraint, err.Error())
					}
					return fmt.Errorf("%w: %s", ErrCreateMovement, err.Error())
				}
			} else { //
				specificExpense := models.SpecificExpense{MovementID: movement.MovementID} //
				if err := tx.Create(&specificExpense).Error; err != nil {                  //
					if strings.Contains(strings.ToLower(err.Error()), "foreign key") || strings.Contains(err.Error(), "1452") {
						return fmt.Errorf("%w: %s", ErrFKConstraint, err.Error())
					}
					return fmt.Errorf("%w: %s", ErrCreateMovement, err.Error())
				}
			}

			// Ya no se replican movimientos en caja global porque no existen cajas globales físicas
			// La "caja global" es solo una vista calculada de la suma de todas las cajas personales
		}
		return nil //
	})
}

// generateReferenceID genera un reference_id único usando timestamp con microsegundos
// Formato: YYYYMMDD-HHMMSS-Microsegundos-UserID
// Esta implementación es thread-safe y no requiere contadores
func (s *MovementService) generateReferenceID(tx *gorm.DB, userID uint) (string, error) {
	now := time.Now()
	// Formato: YYYYMMDD-HHMMSS-Microsegundos-UserID
	// Ejemplo: 20260115-092914-123456-1
	referenceID := fmt.Sprintf("%s-%06d-%d", 
		now.Format("20060102-150405"), 
		now.Nanosecond()/1000, // Microsegundos
		userID,
	)
	
	// Verificar que no exista (muy poco probable con microsegundos, pero por seguridad)
	var exists int64
	err := tx.Model(&models.Movement{}).Where("reference_id = ?", referenceID).Count(&exists).Error
	if err != nil {
		return "", err
	}
	
	// Si por alguna razón existe, agregar un sufijo aleatorio
	if exists > 0 {
		referenceID = fmt.Sprintf("%s-%d", referenceID, now.UnixNano()%1000)
	}
	
	return referenceID, nil
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
		return nil, fmt.Errorf("%w: No hay un arco abierto para este turno. Debe abrir el arco antes de crear movimientos.", ErrNoOpenArco)
	}
	return &arco, nil
}

func (s *MovementService) GetMovementsByArcoID(arcoID uint) ([]models.Movement, error) {
	var movements []models.Movement
	err := database.DB.Preload("Creator").Preload("Concept").Where("arco_id = ?", arcoID).Find(&movements).Error
	if err != nil {
		return nil, err
	}
	return movements, nil
}

// GetAllMovimientosFromAllCajasActivas obtiene TODOS los movimientos de TODAS las cajas personales activas
// Este método se usa para mostrar la vista global al administrador
func (s *MovementService) GetAllMovimientosFromAllCajasActivas() ([]models.Movement, error) {
	var movements []models.Movement
	
	// Obtener los IDs de todas las cajas personales activas
	var arcoIDs []uint
	err := database.DB.Model(&models.Arco{}).
		Where("is_global = ? AND activo = ?", false, true).
		Pluck("id", &arcoIDs).Error
	
	if err != nil {
		return nil, err
	}
	
	if len(arcoIDs) == 0 {
		// No hay cajas activas, retornar lista vacía
		return []models.Movement{}, nil
	}
	
	// Obtener todos los movimientos de esas cajas
	err = database.DB.
		Preload("Creator").
		Preload("Concept").
		Preload("Arco").
		Preload("Arco.Owner"). // Precargar el dueño de cada arco para mostrar de quién es cada movimiento
		Where("arco_id IN ? AND deleted_at IS NULL", arcoIDs).
		Order("created_at DESC").
		Find(&movements).Error
	
	if err != nil {
		return nil, err
	}
	
	return movements, nil
}
