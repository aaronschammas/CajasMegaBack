package services

import (
	"caja-fuerte/database"
	"caja-fuerte/models"
	"errors"
	"time"

	"gorm.io/gorm"
)

// Estructura para mapear la vista de saldo de arqueos
type VistaSaldoArqueo struct {
	ArqueoID      uint       `gorm:"column:arqueo_id"`
	FechaApertura *time.Time `gorm:"column:fecha_apertura"`
	FechaCierre   *time.Time `gorm:"column:fecha_cierre"`
	Turno         string     `gorm:"column:turno"`
	Activo        bool       `gorm:"column:activo"`
	TotalIngresos float64    `gorm:"column:total_ingresos"`
	TotalEgresos  float64    `gorm:"column:total_egresos"`
	SaldoTotal    float64    `gorm:"column:saldo_total"`
}

// Devuelve el saldo del último arco (abierto o cerrado)
func (s *ArcoService) GetSaldoUltimoArco() (*VistaSaldoArqueo, error) {
	var saldo VistaSaldoArqueo
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
	var ultimo models.Arco
	err := database.DB.Where("created_by = ? AND turno = ?", userID, turno).
		Order("id DESC").First(&ultimo).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err == nil && ultimo.Activo {
		// Cerrar el arco abierto
		now := time.Now()
		ultimo.FechaCierre = &now
		ultimo.HoraCierre = &now
		ultimo.Activo = false
		if err := database.DB.Save(&ultimo).Error; err != nil {
			return nil, err
		}
	}
	// Crear un nuevo arco
	nuevoArco := models.Arco{
		CreatedBy:     userID,
		FechaApertura: time.Now(),
		HoraApertura:  time.Now(),
		Turno:         turno,
		Activo:        true,
		Fecha:         time.Now().Truncate(24 * time.Hour),
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
	if err := database.DB.Save(&arco).Error; err != nil {
		return nil, err
	}
	return &arco, nil
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
	err := database.DB.Order("id DESC").First(&ultimo).Error
	if err != nil {
		return nil, err
	}
	return &ultimo, nil
}
