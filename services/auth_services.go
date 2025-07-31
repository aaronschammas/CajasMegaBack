package services

import (
	"caja-fuerte/database" //
	"caja-fuerte/models"   //
	"errors"               //
	"time"                 //

	"github.com/golang-jwt/jwt/v5" //
	"golang.org/x/crypto/bcrypt"   //
)

var jwtSecret = []byte("tu-clave-secreta-muy-segura") // ¡Debería estar en una variable de entorno!

type AuthService struct{} //

func NewAuthService() *AuthService { //
	return &AuthService{} //
}

func (s *AuthService) Login(email, password string) (string, *models.User, error) { //
	var user models.User                                                                                                     //
	if err := database.DB.Preload("Role").Where("email = ? AND is_active = ?", email, true).First(&user).Error; err != nil { //
		return "", nil, errors.New("credenciales inválidas") //
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil { //
		return "", nil, errors.New("credenciales inválidas") //
	}

	// Generar JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{ //
		"user_id": user.UserID,                           //
		"email":   user.Email,                            //
		"role_id": user.RoleID,                           //
		"exp":     time.Now().Add(time.Hour * 24).Unix(), //
	})

	tokenString, err := token.SignedString(jwtSecret) //
	if err != nil {                                   //
		return "", nil, err //
	}

	return tokenString, &user, nil //
}

func (s *AuthService) ValidateToken(tokenString string) (*jwt.MapClaims, error) { //
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) { //
		return jwtSecret, nil //
	})

	if err != nil { //
		return nil, err //
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid { //
		return &claims, nil //
	}

	return nil, errors.New("token inválido") //
}

// GetUserByID busca un usuario por su ID
func (s *AuthService) GetUserByID(userID uint, user *models.User) error {
	return database.DB.First(user, userID).Error
}
