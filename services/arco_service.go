package services

import (
	"caja-fuerte/database"
	"caja-fuerte/models"
	"errors"
	"log"
	"time"

	"gorm.io/gorm"
)

type ArcoService struct{}

func NewArcoService() *ArcoService {
	return &ArcoService{}
}

// Abrir un arco (si el último está cerrado, crea uno nuevo; si está abierto, lo cierra y luego crea uno nuevo)
// NOTA: Ya no existe el concepto de "caja global física". isGlobal se ignora.
// La "caja global" es solo una vista calculada de la suma de todas las cajas personales.
func (s *ArcoService) AbrirArco(userID uint, turno string, isGlobal bool) (*models.Arco, error) {
	// isGlobal ya no tiene sentido - siempre creamos caja personal
	// Solo mantenemos el parámetro por compatibilidad con código existente
	_ = isGlobal
	
	// Si hay un arco personal abierto del usuario para este turno, cerrarlo primero
	var arcoAbierto models.Arco
	errAbierto := database.DB.Where("owner_id = ? AND is_global = ? AND turno = ? AND activo = ?", 
		userID, false, turno, true).First(&arcoAbierto).Error
	
	if errAbierto == nil {
		now := time.Now()
		arcoAbierto.FechaCierre = &now
		arcoAbierto.HoraCierre = &now
		arcoAbierto.Activo = false
		// Calcular y guardar saldo final al cerrar
		saldoFinal, errSaldo := calcularSaldoFinal(database.DB, arcoAbierto.ID, arcoAbierto.SaldoInicial)
		if errSaldo == nil {
			arcoAbierto.SaldoFinal = saldoFinal
		}
		_ = database.DB.Save(&arcoAbierto).Error
	}

	// Obtener el saldo final del último arco personal cerrado del usuario
	var ultimoArcoCerrado models.Arco
	saldoInicialNuevo := 0.0
	errUltimo := database.DB.Where("owner_id = ? AND is_global = ? AND activo = ?", 
		userID, false, false).Order("id DESC").First(&ultimoArcoCerrado).Error
	
	if errUltimo == nil {
		// Si existe un arco cerrado anterior, usar su saldo final
		saldoInicialNuevo = ultimoArcoCerrado.SaldoFinal
		log.Printf("[ARCO] Nuevo arco personal iniciará con saldo: %.2f (tomado del arco ID: %d)", 
			saldoInicialNuevo, ultimoArcoCerrado.ID)
	} else {
		log.Printf("[ARCO] No hay arcos personales cerrados anteriores. Nuevo arco iniciará con saldo: 0.00")
	}

	// Crear un nuevo arco personal con saldo inicial igual al saldo final del arco anterior
	nuevoArco := models.Arco{
		CreatedBy:     userID,
		OwnerID:       userID,
		IsGlobal:      false,  // Siempre false, ya no hay cajas globales físicas
		FechaApertura: time.Now(),
		HoraApertura:  time.Now(),
		Turno:         turno,
		Activo:        true,
		Fecha:         time.Now().Truncate(24 * time.Hour),
		SaldoInicial:  saldoInicialNuevo,
		SaldoFinal:    0,
	}
	if err := database.DB.Create(&nuevoArco).Error; err != nil {
		return nil, err
	}

	log.Printf("[ARCO] Nuevo arco personal creado - ID: %d, Owner: %d, Saldo Inicial: %.2f", 
		nuevoArco.ID, nuevoArco.OwnerID, nuevoArco.SaldoInicial)
	return &nuevoArco, nil
}

// Cerrar un arco (marca como inactivo y registra fecha/hora de cierre)
func (s *ArcoService) CerrarArco(arcoID uint, userID uint) (*models.Arco, error) {
	var arco models.Arco
	if err := database.DB.First(&arco, arcoID).Error; err != nil {
		return nil, err
	}
	
	// Validar permisos: solo el owner o quien lo creó puede cerrarlo
	// Si es caja global, cualquier admin puede cerrarla (se valida en el controlador)
	if !arco.IsGlobal && arco.OwnerID != userID {
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
	saldoFinal, errSaldo := calcularSaldoFinal(database.DB, arco.ID, arco.SaldoInicial)
	if errSaldo == nil {
		arco.SaldoFinal = saldoFinal
	}
	if err := database.DB.Save(&arco).Error; err != nil {
		return nil, err
	}

	log.Printf("[ARCO] Arco cerrado - ID: %d, Owner: %d, Saldo Final: %.2f", arco.ID, arco.OwnerID, arco.SaldoFinal)
	return &arco, nil
}

// CerrarArcoConRetiro cierra el arco y opcionalmente crea un movimiento tipo RetiroCaja
// con el monto especificado, todo dentro de una transacción para mantener consistencia.
func (s *ArcoService) CerrarArcoConRetiro(arcoID uint, userID uint, retiroAmount float64) (*models.Arco, error) {
	var resultArco models.Arco
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var arco models.Arco
		// Precargar la relación Usuario para que esté disponible en el frontend
		if err := tx.Preload("Usuario").First(&arco, arcoID).Error; err != nil {
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
		saldoFinal, err := calcularSaldoFinal(tx, arco.ID, arco.SaldoInicial)
		if err == nil {
			arco.SaldoFinal = saldoFinal
		}

		if err := tx.Save(&arco).Error; err != nil {
			return err
		}

		log.Printf("[ARCO] Arco cerrado con retiro - ID: %d, Saldo Final: %.2f, Retiro: %.2f", arco.ID, arco.SaldoFinal, retiroAmount)
		resultArco = arco
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &resultArco, nil
}

// calcularSaldoFinal calcula el saldo final de un arco usando la conexión db dada.
// Acepta tanto database.DB como un *gorm.DB de transacción.
func calcularSaldoFinal(db *gorm.DB, arcoID uint, saldoInicial float64) (float64, error) {
	type Result struct {
		Ingresos float64
		Egresos  float64
		Retiros  float64
	}
	var res Result
	err := db.Raw(`
		SELECT
			COALESCE(SUM(CASE WHEN movement_type = 'Ingreso' THEN amount ELSE 0 END),0) AS ingresos,
			COALESCE(SUM(CASE WHEN movement_type = 'Egreso' THEN amount ELSE 0 END),0) AS egresos,
			COALESCE(SUM(CASE WHEN movement_type = 'RetiroCaja' THEN amount ELSE 0 END),0) AS retiros
		FROM movements WHERE arco_id = ? AND deleted_at IS NULL`, arcoID).Scan(&res).Error
	if err != nil {
		return saldoInicial, err
	}
	return saldoInicial + res.Ingresos - res.Egresos - res.Retiros, nil
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

// Devuelve el último arco (por ID) en la base de datos. Retorna error si no existe ninguno.
func (s *ArcoService) GetLastArco() (*models.Arco, error) {
	var ultimo models.Arco
	err := database.DB.Preload("Usuario").Order("id DESC").First(&ultimo).Error
	if err != nil {
		return nil, err
	}
	return &ultimo, nil
}

// GetArcoActivoUsuario obtiene el arco activo de un usuario específico (caja personal)
func (s *ArcoService) GetArcoActivoUsuario(userID uint) (*models.Arco, error) {
	var arco models.Arco
	err := database.DB.Where("owner_id = ? AND is_global = ? AND activo = ?", userID, false, true).First(&arco).Error
	if err != nil {
		return nil, err
	}
	return &arco, nil
}

// GetLastArcoUsuario obtiene el último arco (activo o cerrado) de un usuario específico
func (s *ArcoService) GetLastArcoUsuario(userID uint) (*models.Arco, error) {
	var arco models.Arco
	err := database.DB.Preload("Usuario").Where("owner_id = ? AND is_global = ?", userID, false).Order("id DESC").First(&arco).Error
	if err != nil {
		return nil, err
	}
	return &arco, nil
}

// GetSaldoArcoUsuario obtiene el saldo del arco activo de un usuario
func (s *ArcoService) GetSaldoArcoUsuario(userID uint, isGlobal bool) (*models.VistaSaldoArqueo, error) {
	var saldo models.VistaSaldoArqueo
	var err error
	
	if isGlobal {
		// NUEVA LÓGICA: La caja global es la suma de TODAS las cajas activas de TODOS los usuarios
		log.Printf("[ARCO] Calculando caja GLOBAL (suma de todas las cajas)")
		
		// Sumar los saldos de todas las cajas personales activas
		type GlobalSum struct {
			SaldoInicial   float64
			TotalIngresos  float64
			TotalEgresos   float64
			TotalRetiros   float64
			SaldoTotal     float64
			CajasActivas   int64
		}
		
		var globalSum GlobalSum
		err = database.DB.Raw(`
			SELECT 
				COALESCE(SUM(saldo_inicial), 0) AS saldo_inicial,
				COALESCE(SUM(total_ingresos), 0) AS total_ingresos,
				COALESCE(SUM(total_egresos), 0) AS total_egresos,
				COALESCE(SUM(total_retiros), 0) AS total_retiros,
				COALESCE(SUM(saldo_total), 0) AS saldo_total,
				COUNT(*) AS cajas_activas
			FROM vista_saldo_arqueos 
			WHERE is_global = false AND activo = true
		`).Scan(&globalSum).Error
		
		if err != nil {
			return nil, err
		}
		
		if globalSum.CajasActivas == 0 {
			return nil, errors.New("No hay cajas personales activas en el sistema")
		}
		
		// Crear un objeto VistaSaldoArqueo virtual para la caja global
		saldo = models.VistaSaldoArqueo{
			ArqueoID:      0, // ID virtual para caja global
			OwnerID:       0, // Sin dueño específico (representa a todos)
			IsGlobal:      true,
			Activo:        true,
			SaldoInicial:  globalSum.SaldoInicial,
			TotalIngresos: globalSum.TotalIngresos,
			TotalEgresos:  globalSum.TotalEgresos,
			TotalRetiros:  globalSum.TotalRetiros,
			SaldoTotal:    globalSum.SaldoTotal,
		}
		
		log.Printf("[ARCO] Caja GLOBAL calculada - Cajas activas: %d, Saldo Total: %.2f", 
			globalSum.CajasActivas, globalSum.SaldoTotal)
		
	} else {
		// Caja personal del usuario
		log.Printf("[ARCO] Buscando caja PERSONAL para usuario %d", userID)
		err = database.DB.Raw(`
			SELECT * FROM vista_saldo_arqueos 
			WHERE owner_id = ? AND is_global = false AND activo = true 
			ORDER BY arqueo_id DESC LIMIT 1
		`, userID).Scan(&saldo).Error
		
		if err != nil || saldo.ArqueoID == 0 {
			log.Printf("[ARCO] No se encontró caja personal activa para usuario %d", userID)
			return nil, errors.New("No tienes ninguna caja personal activa. Por favor, abre una caja primero")
		}
		
		log.Printf("[ARCO] Saldo encontrado exitosamente - ArqueoID: %d, IsGlobal: %t, OwnerID: %d, SaldoTotal: %.2f", 
			saldo.ArqueoID, saldo.IsGlobal, saldo.OwnerID, saldo.SaldoTotal)
	}
	
	return &saldo, nil
}
