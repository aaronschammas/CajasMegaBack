package utils

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// HandleDBError maneja errores de base de datos de forma segura
// NO expone detalles internos al cliente
func HandleDBError(ctx *gin.Context, err error, operation string) {
	Logger.Error("Database error",
		zap.String("operation", operation),
		zap.Error(err),
		zap.String("ip", ctx.ClientIP()),
		zap.String("path", ctx.Request.URL.Path),
	)

	// NO exponer detalles del error al cliente
	ctx.JSON(http.StatusInternalServerError, gin.H{
		"error": "Error interno del servidor",
		"code":  "DATABASE_ERROR",
	})
}

// HandleValidationError maneja errores de validación
func HandleValidationError(ctx *gin.Context, err error) {
	Logger.Warn("Validation error",
		zap.Error(err),
		zap.String("ip", ctx.ClientIP()),
		zap.String("path", ctx.Request.URL.Path),
	)

	ctx.JSON(http.StatusBadRequest, gin.H{
		"error": err.Error(),
		"code":  "VALIDATION_ERROR",
	})
}

// HandleAuthError maneja errores de autenticación
func HandleAuthError(ctx *gin.Context, message string) {
	Logger.Warn("Authentication error",
		zap.String("message", message),
		zap.String("ip", ctx.ClientIP()),
		zap.String("path", ctx.Request.URL.Path),
	)

	ctx.JSON(http.StatusUnauthorized, gin.H{
		"error": message,
		"code":  "AUTH_ERROR",
	})
}

// HandleNotFoundError maneja errores de recurso no encontrado
func HandleNotFoundError(ctx *gin.Context, resource string) {
	Logger.Warn("Resource not found",
		zap.String("resource", resource),
		zap.String("ip", ctx.ClientIP()),
		zap.String("path", ctx.Request.URL.Path),
	)

	ctx.JSON(http.StatusNotFound, gin.H{
		"error": resource + " no encontrado",
		"code":  "NOT_FOUND",
	})
}

// HandleForbiddenError maneja errores de acceso denegado
func HandleForbiddenError(ctx *gin.Context, message string) {
	Logger.Warn("Access forbidden",
		zap.String("message", message),
		zap.String("ip", ctx.ClientIP()),
		zap.String("path", ctx.Request.URL.Path),
	)

	ctx.JSON(http.StatusForbidden, gin.H{
		"error": message,
		"code":  "FORBIDDEN",
	})
}

// HandleBusinessLogicError maneja errores de lógica de negocio
func HandleBusinessLogicError(ctx *gin.Context, err error, userMessage string) {
	Logger.Warn("Business logic error",
		zap.Error(err),
		zap.String("user_message", userMessage),
		zap.String("ip", ctx.ClientIP()),
	)

	ctx.JSON(http.StatusBadRequest, gin.H{
		"error": userMessage,
		"code":  "BUSINESS_ERROR",
	})
}

// HandleSuccess maneja respuestas exitosas de forma consistente
func HandleSuccess(ctx *gin.Context, data interface{}, message string) {
	response := gin.H{
		"success": true,
		"message": message,
	}

	if data != nil {
		response["data"] = data
	}

	ctx.JSON(http.StatusOK, response)
}
