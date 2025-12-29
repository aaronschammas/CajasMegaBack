package services

import (
	"caja-fuerte/database"
	"caja-fuerte/models"
	"errors"
	"log"
	"time"

	"gorm.io/gorm"
)

// Devuelve el saldo del último arco (abierto o cerrado)
func (s *ArcoService) GetSaldoUltimoArco() (*models.VistaSaldoArqueo, error) {
	var saldo models.VistaSaldoArqueo
	err := database.DB.Raw(`SELECT * FROM vista_saldo_arqueos ORDER BY arqueo_id DESC LIMIT 1`).Scan(&saldo).Error
	if err != nil {
		return nil, err
	}
	return &saldo, nil
}

type ArcoService struct{}

func NewArcoService() *ArcoService {
	return &ArcoService{}
}

// Abrir un arco (si el último está cerrado, crea uno nuevo; si está abierto, lo cierra y luego crea uno nuevo)
func (s *ArcoService) AbrirArco(userID uint, turno string) (*models.Arco, error) {
	// Nuevo comportamiento: al abrir un arco siempre iniciar saldo en 0
	// Si hay un arco abierto del mismo usuario y turno, cerrarlo
	var arcoAbierto models.Arco
	errAbierto := database.DB.Where("created_by = ? AND turno = ? AND activo = ?", userID, turno, true).First(&arcoAbierto).Error
	if errAbierto == nil {
		now := time.Now()
		arcoAbierto.FechaCierre = &now
		arcoAbierto.HoraCierre = &now
		arcoAbierto.Activo = false
		// Calcular y guardar saldo final al cerrar
		saldoFinal, errSaldo := calcularSaldoFinal(arcoAbierto.ID, arcoAbierto.SaldoInicial)
		if errSaldo == nil {
			arcoAbierto.SaldoFinal = saldoFinal
		}
		_ = database.DB.Save(&arcoAbierto).Error
	}
	// Crear un nuevo arco con saldo inicial
	nuevoArco := models.Arco{
		CreatedBy:     userID,
		FechaApertura: time.Now(),
		HoraApertura:  time.Now(),
		Turno:         turno,
		Activo:        true,
		Fecha:         time.Now().Truncate(24 * time.Hour),
		SaldoInicial:  0,
		SaldoFinal:    0,
	}
	if err := database.DB.Create(&nuevoArco).Error; err != nil {
		return nil, err
	}
	return &nuevoArco, nil
}

// Cerrar un arco (marca como inactivo y registra fecha/hora de cierre)
func (s *ArcoService) CerrarArco(arcoID uint, userID uint) (*models.Arco, error) {
	var arco models.Arco
	if err := database.DB.First(&arco, arcoID).Error; err != nil {
		return nil, err
	}
	if arco.CreatedBy != userID {
		return nil, errors.New("No autorizado para cerrar este arco")
	}
	if !arco.Activo {
		return nil, errors.New("El arco ya está cerrado")
	}
	now := time.Now()
	arco.FechaCierre = &now
	arco.HoraCierre = &now
	arco.Activo = false
	// Calcular y guardar saldo final
	saldoFinal, errSaldo := calcularSaldoFinal(arco.ID, arco.SaldoInicial)
	if errSaldo == nil {
		arco.SaldoFinal = saldoFinal
	}
	if err := database.DB.Save(&arco).Error; err != nil {
		return nil, err
	}
	return &arco, nil
}

// CerrarArcoConRetiro cierra el arco y opcionalmente crea un movimiento tipo RetiroCaja
// con el monto especificado, todo dentro de una transacción para mantener consistencia.
func (s *ArcoService) CerrarArcoConRetiro(arcoID uint, userID uint, retiroAmount float64) (*models.Arco, error) {
	var resultArco models.Arco
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var arco models.Arco
		if err := tx.First(&arco, arcoID).Error; err != nil {
			return err
		}
		if arco.CreatedBy != userID {
			return errors.New("No autorizado para cerrar este arco")
		}
		if !arco.Activo {
			return errors.New("El arco ya está cerrado")
		}

		// Si se indicó retiro y es mayor a 0, crear movimiento RetiroCaja asociado al arco antes de cerrarlo
		if retiroAmount > 0 {
			// Generar reference id usando el mismo contador que el servicio de movimientos
			ms := NewMovementService()
			ref, err := ms.generateReferenceID(tx, userID)
			if err != nil {
				return err
			}
			// Buscar o crear un concepto adecuado para RetiroCaja
			conceptID, err := getOrCreateRetiroConcept(tx, userID)
			if err != nil {
				return err
			}

			// Verificar explícita que el concept existe; si no, crear uno nuevo
			var checkConcept models.ConceptType
			if err := tx.First(&checkConcept, conceptID).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					log.Printf("Concepto %d no encontrado, creando uno nuevo\n", conceptID)
					// crear uno nuevo
					now := time.Now()
					newConcept := models.ConceptType{
						ConceptName:             "Retiro",
						MovementTypeAssociation: "RetiroCaja",
						IsActive:                true,
						CreatedBy:               &userID,
						CreatedAt:               now,
					}
					if err := tx.Create(&newConcept).Error; err != nil {
						return err
					}
					conceptID = newConcept.ConceptID
				} else {
					return err
				}
			}

			movement := models.Movement{
				ReferenceID:  ref,
				MovementType: "RetiroCaja",
				MovementDate: time.Now(),
				Amount:       retiroAmount,
				Shift:        arco.Turno,
				ConceptID:    conceptID,
				Details:      "Retiro de caja al cerrar arqueo",
				CreatedBy:    userID,
				ArcoID:       arco.ID,
			}
			if err := tx.Create(&movement).Error; err != nil {
				return err
			}
			specificExpense := models.SpecificExpense{MovementID: movement.MovementID}
			if err := tx.Create(&specificExpense).Error; err != nil {
				return err
			}
		}

		// Marcar cierre del arco
		now := time.Now()
		arco.FechaCierre = &now
		arco.HoraCierre = &now
		arco.Activo = false

		// Calcular saldo final usando tx
		saldoFinal, err := calcularSaldoFinalTx(tx, arco.ID, arco.SaldoInicial)
		if err == nil {
			arco.SaldoFinal = saldoFinal
		}

		if err := tx.Save(&arco).Error; err != nil {
			return err
		}
		resultArco = arco
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &resultArco, nil
}

// calcularSaldoFinalTx es la versión transaccional de calcularSaldoFinal que usa el tx dado.
func calcularSaldoFinalTx(tx *gorm.DB, arcoID uint, saldoInicial float64) (float64, error) {
	type Result struct {
		Ingresos float64
		Egresos  float64
		Retiros  float64
	}
	var res Result
	err := tx.Raw(`
	   SELECT
		   COALESCE(SUM(CASE WHEN movement_type = 'Ingreso' THEN amount ELSE 0 END),0) AS ingresos,
		   COALESCE(SUM(CASE WHEN movement_type = 'Egreso' THEN amount ELSE 0 END),0) AS egresos,
		   COALESCE(SUM(CASE WHEN movement_type = 'RetiroCaja' THEN amount ELSE 0 END),0) AS retiros
	   FROM movements WHERE arco_id = ? AND deleted_at IS NULL`, arcoID).Scan(&res).Error
	if err != nil {
		return saldoInicial, err
	}
	saldoFinal := saldoInicial + res.Ingresos - res.Egresos - res.Retiros
	return saldoFinal, nil
}

// calcularSaldoFinal calcula el saldo final de un arco dado su saldo inicial y los movimientos asociados
func calcularSaldoFinal(arcoID uint, saldoInicial float64) (float64, error) {
	type Result struct {
		Ingresos float64
		Egresos  float64
		Retiros  float64
	}
	var res Result
	err := database.DB.Raw(`
	       SELECT
		       COALESCE(SUM(CASE WHEN movement_type = 'Ingreso' THEN amount ELSE 0 END),0) AS ingresos,
		       COALESCE(SUM(CASE WHEN movement_type = 'Egreso' THEN amount ELSE 0 END),0) AS egresos,
		       COALESCE(SUM(CASE WHEN movement_type = 'RetiroCaja' THEN amount ELSE 0 END),0) AS retiros
	       FROM movements WHERE arco_id = ? AND deleted_at IS NULL`, arcoID).Scan(&res).Error
	if err != nil {
		return saldoInicial, err
	}
	saldoFinal := saldoInicial + res.Ingresos - res.Egresos - res.Retiros
	return saldoFinal, nil
}

// getOrCreateRetiroConcept busca un concepto existente para retiros (mov. 'RetiroCaja' o nombre que contenga 'retiro')
// y lo devuelve. Si no existe, crea uno nuevo dentro de la misma transacción `tx`.
func getOrCreateRetiroConcept(tx *gorm.DB, userID uint) (uint, error) {
	var concept models.ConceptType
	// Primero intentar por association explícita
	if err := tx.Where("movement_type_association = ?", "RetiroCaja").First(&concept).Error; err == nil {
		return concept.ConceptID, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, err
	}

	// Luego intentar por nombre que contenga 'retiro' (case-insensitive)
	if err := tx.Where("LOWER(concept_name) LIKE ?", "%retiro%").First(&concept).Error; err == nil {
		return concept.ConceptID, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, err
	}

	// No existe, crear uno nuevo
	now := time.Now()
	newConcept := models.ConceptType{
		ConceptName:             "Retiro",
		MovementTypeAssociation: "RetiroCaja",
		IsActive:                true,
		CreatedBy:               &userID,
		CreatedAt:               now,
	}
	if err := tx.Create(&newConcept).Error; err != nil {
		return 0, err
	}
	return newConcept.ConceptID, nil
}

// Devuelve true si el último arco (por ID) está abierto, false si está cerrado o no existe
func (s *ArcoService) UltimoArcoAbiertoOCerrado() (bool, error) {
	var ultimo models.Arco
	err := database.DB.Order("id DESC").First(&ultimo).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// No existe ningún arco, se puede crear uno nuevo
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if ultimo.Activo {
		// Hay un arco abierto, hay que cerrarlo antes de crear uno nuevo
		return true, nil
	}
	// El último arco está cerrado, se puede crear uno nuevo
	return false, nil
}

// Cierra el arco abierto y abre uno nuevo (transacción atómica)
func (s *ArcoService) CerrarYAbrirNuevoArco(userID uint, turno string) (*models.Arco, error) {
	var nuevoArco models.Arco
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var arco models.Arco
		err := tx.Where("created_by = ? AND turno = ? AND activo = ?", userID, turno, true).First(&arco).Error
		if err == nil {
			now := time.Now()
			arco.FechaCierre = &now
			arco.HoraCierre = &now
			arco.Activo = false
			if err := tx.Save(&arco).Error; err != nil {
				return err
			}
		}
		nuevoArco = models.Arco{
			CreatedBy:     userID,
			FechaApertura: time.Now(),
			HoraApertura:  time.Now(),
			Turno:         turno,
			Activo:        true,
			Fecha:         time.Now().Truncate(24 * time.Hour),
		}
		if err := tx.Create(&nuevoArco).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &nuevoArco, nil
}

// Devuelve el último arco (por ID) en la base de datos. Retorna error si no existe ninguno.
func (s *ArcoService) GetLastArco() (*models.Arco, error) {
	var ultimo models.Arco
	err := database.DB.Preload("Usuario").Order("id DESC").First(&ultimo).Error
	if err != nil {
		return nil, err
	}
	return &ultimo, nil
}
