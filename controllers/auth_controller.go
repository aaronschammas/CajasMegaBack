package controllers

import (
	"caja-fuerte/models"   //
	"caja-fuerte/services" //
	"net/http"             //

	"github.com/gin-gonic/gin" //
)

type AuthController struct { //
	authService *services.AuthService //
}

func NewAuthController() *AuthController { //
	return &AuthController{ //
		authService: services.NewAuthService(), //
	}
}

func (c *AuthController) Login(ctx *gin.Context) { //
	var req models.LoginRequest                      //
	if err := ctx.ShouldBindJSON(&req); err != nil { //
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}) //
		return                                                       //
	}

	token, user, err := c.authService.Login(req.Email, req.Password) //
	if err != nil {                                                  //
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()}) //
		return                                                         //
	}

	ctx.JSON(http.StatusOK, gin.H{ //
		"token": token, //
		"user":  user,  //
	})
}

func (c *AuthController) Logout(ctx *gin.Context) { //
	// En implementación JWT stateless, el logout se maneja en el frontend
	ctx.JSON(http.StatusOK, gin.H{"message": "Logout exitoso"}) //
}
