package validators

import (
	"caja-fuerte/models"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
)

var (
	// Política de sanitización HTML (muy restrictiva)
	htmlPolicy = bluemonday.StrictPolicy()

	// Regex para validaciones
	emailRegex    = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	dbNameRegex   = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)
	alphanumRegex = regexp.MustCompile(`^[a-zA-Z0-9\s\-_.,]+$`)
)

// Errores comunes de validación
var (
	ErrInvalidEmail        = errors.New("formato de email inválido")
	ErrPasswordTooShort    = errors.New("la contraseña debe tener al menos 8 caracteres")
	ErrInvalidAmount       = errors.New("el monto debe ser mayor a 0")
	ErrAmountTooLarge      = errors.New("el monto excede el límite permitido")
	ErrInvalidShift        = errors.New("turno inválido (debe ser M o T)")
	ErrInvalidMovementType = errors.New("tipo de movimiento inválido")
	ErrDetailsTooLong      = errors.New("los detalles no pueden exceder 500 caracteres")
	ErrInvalidDBName       = errors.New("nombre de base de datos inválido")
)

// ValidateMovementRequest valida una petición de movimiento
func ValidateMovementRequest(req *models.MovementRequest) error {
	// Validar monto
	if req.Amount <= 0 {
		return ErrInvalidAmount
	}

	if req.Amount > 10000000 { // 10 millones
		return ErrAmountTooLarge
	}

	// Validar turno
	if req.Shift != "M" && req.Shift != "T" {
		return ErrInvalidShift
	}

	// Validar tipo de movimiento
	validTypes := []string{"Ingreso", "Egreso", "RetiroCaja"}
	if !contains(validTypes, req.MovementType) {
		return ErrInvalidMovementType
	}

	// Validar y sanitizar detalles
	if len(req.Details) > 500 {
		return ErrDetailsTooLong
	}

	// Sanitizar HTML en detalles
	req.Details = SanitizeHTML(req.Details)

	// Validar concept_id (debe ser > 0)
	if req.ConceptID == 0 {
		return errors.New("concept_id es requerido")
	}

	return nil
}

// ValidateBatchMovementRequest valida múltiples movimientos
func ValidateBatchMovementRequest(req *models.BatchMovementRequest) error {
	if len(req.Movements) == 0 {
		return errors.New("debe proporcionar al menos un movimiento")
	}

	if len(req.Movements) > 100 {
		return errors.New("no se pueden procesar más de 100 movimientos a la vez")
	}

	for i, mov := range req.Movements {
		if err := ValidateMovementRequest(&mov); err != nil {
			return fmt.Errorf("movimiento %d: %w", i+1, err)
		}
	}

	return nil
}

// ValidateLoginRequest valida credenciales de login
func ValidateLoginRequest(email, password string) error {
	// Validar email
	if !emailRegex.MatchString(email) {
		return ErrInvalidEmail
	}

	if len(email) > 255 {
		return errors.New("el email es demasiado largo")
	}

	// Validar password
	if len(password) < 8 {
		return ErrPasswordTooShort
	}

	if len(password) > 128 {
		return errors.New("la contraseña es demasiado larga")
	}

	return nil
}

// ValidateDBName valida el nombre de una base de datos
func ValidateDBName(name string) error {
	if name == "" {
		return errors.New("el nombre de la base de datos no puede estar vacío")
	}

	if len(name) > 64 {
		return errors.New("el nombre de la base de datos es demasiado largo")
	}

	if !dbNameRegex.MatchString(name) {
		return ErrInvalidDBName
	}

	return nil
}

// ValidateArcoRequest valida la apertura/cierre de arco
func ValidateArcoRequest(turno string, arcoID uint) error {
	if turno != "M" && turno != "T" {
		return ErrInvalidShift
	}

	if arcoID != 0 && arcoID > 4294967295 { // límite de uint
		return errors.New("arco_id inválido")
	}

	return nil
}

// ValidateRetiroAmount valida el monto de retiro
func ValidateRetiroAmount(amount float64, saldoDisponible float64) error {
	if amount < 0 {
		return errors.New("el monto de retiro no puede ser negativo")
	}

	if amount > saldoDisponible {
		return errors.New("el monto de retiro excede el saldo disponible")
	}

	if amount > 10000000 { // 10 millones
		return errors.New("el monto de retiro excede el límite permitido")
	}

	return nil
}

// SanitizeHTML elimina todo el HTML de un string
func SanitizeHTML(input string) string {
	return htmlPolicy.Sanitize(input)
}

// SanitizeString sanitiza un string general (quita espacios, etc.)
func SanitizeString(input string) string {
	// Trimear espacios
	input = strings.TrimSpace(input)

	// Remover caracteres de control
	input = strings.Map(func(r rune) rune {
		if r < 32 && r != '\n' && r != '\r' && r != '\t' {
			return -1
		}
		return r
	}, input)

	return input
}

// ValidateAndSanitizeEmail valida y normaliza un email
func ValidateAndSanitizeEmail(email string) (string, error) {
	// Normalizar
	email = strings.ToLower(strings.TrimSpace(email))

	// Validar
	if !emailRegex.MatchString(email) {
		return "", ErrInvalidEmail
	}

	if len(email) > 255 {
		return "", errors.New("el email es demasiado largo")
	}

	return email, nil
}

// contains verifica si un slice contiene un elemento
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// ValidatePositiveInt valida que un entero sea positivo
func ValidatePositiveInt(value int, fieldName string) error {
	if value <= 0 {
		return fmt.Errorf("%s debe ser mayor a 0", fieldName)
	}
	return nil
}

// ValidatePositiveUint valida que un uint sea positivo
func ValidatePositiveUint(value uint, fieldName string) error {
	if value == 0 {
		return fmt.Errorf("%s debe ser mayor a 0", fieldName)
	}
	return nil
}

// ValidateStringLength valida la longitud de un string
func ValidateStringLength(s, fieldName string, min, max int) error {
	length := len(s)
	if length < min {
		return fmt.Errorf("%s debe tener al menos %d caracteres", fieldName, min)
	}
	if length > max {
		return fmt.Errorf("%s no puede exceder %d caracteres", fieldName, max)
	}
	return nil
}

// IsAlphanumeric verifica si un string es alfanumérico (con algunos caracteres especiales permitidos)
func IsAlphanumeric(s string) bool {
	return alphanumRegex.MatchString(s)
}
