package services

import (
	"caja-fuerte/config"
	"caja-fuerte/database"
	"caja-fuerte/models"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// jwtSecret se inicializa desde la configuración
var jwtSecret []byte

type AuthService struct{}

func NewAuthService() *AuthService {
	return &AuthService{}
}

// InitAuthService inicializa el servicio de autenticación con el secret desde config
func InitAuthService() error {
	if config.AppConfig == nil {
		return errors.New("config.AppConfig no está inicializado")
	}

	if config.AppConfig.JWTSecret == "" {
		return errors.New("JWT_SECRET no configurado")
	}

	jwtSecret = []byte(config.AppConfig.JWTSecret)
	return nil
}

// Login autentica un usuario y retorna un JWT token
func (s *AuthService) Login(email, password string) (string, *models.User, error) {
	var user models.User

	// Buscar usuario por email (case-insensitive) y que esté activo
	if err := database.DB.Preload("Role").
		Where("LOWER(email) = LOWER(?) AND is_active = ?", email, true).
		First(&user).Error; err != nil {
		return "", nil, errors.New("credenciales inválidas")
	}

	// Verificar contraseña
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", nil, errors.New("credenciales inválidas")
	}

	// Generar JWT token
	expirationHours := config.AppConfig.JWTExpirationHours
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.UserID,
		"email":   user.Email,
		"role_id": user.RoleID,
		"exp":     time.Now().Add(time.Hour * time.Duration(expirationHours)).Unix(),
		"iat":     time.Now().Unix(), // Issued at
		"nbf":     time.Now().Unix(), // Not before
	})

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", nil, errors.New("error generando token")
	}

	return tokenString, &user, nil
}

// ✅ NUEVO: Register crea un nuevo usuario
func (s *AuthService) Register(email, password, fullName string) (*models.User, error) {
	// Validar que el email no exista
	var existingUser models.User
	if err := database.DB.Where("LOWER(email) = LOWER(?)", email).First(&existingUser).Error; err == nil {
		return nil, errors.New("el email ya está registrado")
	}

	// Hashear contraseña
	hashedPassword, err := s.HashPassword(password)
	if err != nil {
		return nil, errors.New("error al procesar la contraseña")
	}

	// Obtener el rol por defecto (buscar "Usuario" o el primer rol disponible)
	var defaultRole models.Role
	if err := database.DB.Where("role_name = ?", "Usuario").First(&defaultRole).Error; err != nil {
		// Si no existe rol "Usuario", obtener el primer rol disponible
		if err := database.DB.First(&defaultRole).Error; err != nil {
			return nil, errors.New("no hay roles configurados en el sistema")
		}
	}

	// Crear usuario
	user := models.User{
		Email:        email,
		PasswordHash: hashedPassword,
		FullName:     fullName,
		RoleID:       defaultRole.RoleID,
		IsActive:     true,
		CreatedAt:    time.Now(),
	}

	if err := database.DB.Create(&user).Error; err != nil {
		return nil, errors.New("error al crear el usuario")
	}

	// Cargar la relación Role
	database.DB.Preload("Role").First(&user, user.UserID)

	return &user, nil
}

// ValidateToken valida un JWT token y retorna los claims
func (s *AuthService) ValidateToken(tokenString string) (*jwt.MapClaims, error) {
	if len(jwtSecret) == 0 {
		return nil, errors.New("servicio de autenticación no inicializado")
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Verificar que el método de firma sea el esperado
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("método de firma inválido")
		}
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		// Verificar expiración explícitamente
		if exp, ok := claims["exp"].(float64); ok {
			if time.Now().Unix() > int64(exp) {
				return nil, errors.New("token expirado")
			}
		}

		// Verificar not before
		if nbf, ok := claims["nbf"].(float64); ok {
			if time.Now().Unix() < int64(nbf) {
				return nil, errors.New("token aún no válido")
			}
		}

		return &claims, nil
	}

	return nil, errors.New("token inválido")
}

// GetUserByID busca un usuario por su ID
func (s *AuthService) GetUserByID(userID uint, user *models.User) error {
	return database.DB.Preload("Role").First(user, userID).Error
}

// HashPassword hashea una contraseña usando bcrypt
func (s *AuthService) HashPassword(password string) (string, error) {
	saltRounds := config.AppConfig.PasswordSaltRounds
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), saltRounds)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// VerifyPassword verifica si una contraseña coincide con un hash
func (s *AuthService) VerifyPassword(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// RefreshToken genera un nuevo token para un usuario existente
func (s *AuthService) RefreshToken(oldTokenString string) (string, error) {
	// Validar el token anterior
	claims, err := s.ValidateToken(oldTokenString)
	if err != nil {
		return "", err
	}

	// Extraer user_id
	userIDFloat, ok := (*claims)["user_id"].(float64)
	if !ok {
		return "", errors.New("token inválido: user_id no encontrado")
	}
	userID := uint(userIDFloat)

	// Buscar usuario
	var user models.User
	if err := s.GetUserByID(userID, &user); err != nil {
		return "", errors.New("usuario no encontrado")
	}

	// Verificar que el usuario siga activo
	if !user.IsActive {
		return "", errors.New("usuario inactivo")
	}

	// Generar nuevo token
	expirationHours := config.AppConfig.JWTExpirationHours
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.UserID,
		"email":   user.Email,
		"role_id": user.RoleID,
		"exp":     time.Now().Add(time.Hour * time.Duration(expirationHours)).Unix(),
		"iat":     time.Now().Unix(),
		"nbf":     time.Now().Unix(),
	})

	return token.SignedString(jwtSecret)
}

// InvalidateToken invalida un token (implementación básica)
// TODO: Implementar blacklist real con Redis
func (s *AuthService) InvalidateToken(tokenString string) error {
	// Por ahora, solo validamos que el token sea válido
	_, err := s.ValidateToken(tokenString)
	if err != nil {
		return errors.New("token ya inválido")
	}

	// TODO: Agregar a blacklist en Redis
	// redis.Set("blacklist:"+tokenString, "1", config.AppConfig.JWTExpirationHours)

	return nil
}

// ChangePassword cambia la contraseña de un usuario
func (s *AuthService) ChangePassword(userID uint, oldPassword, newPassword string) error {
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		return errors.New("usuario no encontrado")
	}

	// Verificar contraseña antigua
	if err := s.VerifyPassword(oldPassword, user.PasswordHash); err != nil {
		return errors.New("contraseña actual incorrecta")
	}

	// Hashear nueva contraseña
	newHash, err := s.HashPassword(newPassword)
	if err != nil {
		return errors.New("error hasheando nueva contraseña")
	}

	// Actualizar en BD
	user.PasswordHash = newHash
	if err := database.DB.Save(&user).Error; err != nil {
		return errors.New("error actualizando contraseña")
	}

	return nil
}

// GetUserByEmail busca un usuario por email
func (s *AuthService) GetUserByEmail(email string) (*models.User, error) {
	var user models.User
	if err := database.DB.Preload("Role").
		Where("LOWER(email) = LOWER(?)", email).
		First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}
