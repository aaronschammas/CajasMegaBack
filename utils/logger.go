package utils

import (
	"os"
	"strings"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var Logger *zap.Logger
var SugarLogger *zap.SugaredLogger

// InitLogger inicializa el logger según el entorno
func InitLogger(env string) error {
	var config zap.Config

	if env == "production" {
		// JSON estructurado en producción
		config = zap.NewProductionConfig()
		config.Encoding = "json"
		config.Level = zap.NewAtomicLevelAt(zapcore.InfoLevel)

		// Agregar caller info en producción
		config.EncoderConfig.MessageKey = "message"
		config.EncoderConfig.LevelKey = "level"
		config.EncoderConfig.TimeKey = "timestamp"
		config.EncoderConfig.CallerKey = "caller"
		config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
		config.EncoderConfig.EncodeLevel = zapcore.CapitalLevelEncoder

	} else {
		// Formato legible en desarrollo
		config = zap.NewDevelopmentConfig()
		config.Encoding = "console"
		config.Level = zap.NewAtomicLevelAt(zapcore.DebugLevel)
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
		config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	}

	// Configurar outputs (stdout y archivo opcional)
	if logFile := os.Getenv("LOG_FILE"); logFile != "" {
		config.OutputPaths = []string{"stdout", logFile}
		config.ErrorOutputPaths = []string{"stderr", logFile}
	}

	var err error
	Logger, err = config.Build(zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	if err != nil {
		return err
	}

	SugarLogger = Logger.Sugar()

	// Reemplazar el logger global de zap
	zap.ReplaceGlobals(Logger)

	return nil
}

// Close cierra el logger de forma segura
func Close() error {
	if Logger != nil {
		return Logger.Sync()
	}
	return nil
}

// SanitizeForLog sanitiza datos sensibles antes de loggearlos
func SanitizeForLog(data map[string]interface{}) map[string]interface{} {
	sensitiveKeys := []string{
		"password",
		"token",
		"secret",
		"authorization",
		"jwt",
		"session",
		"cookie",
		"api_key",
		"apikey",
		"access_token",
		"refresh_token",
	}

	sanitized := make(map[string]interface{})
	for k, v := range data {
		if containsCaseInsensitive(sensitiveKeys, k) {
			sanitized[k] = "***REDACTED***"
		} else {
			// Si es un string, verificar si contiene patrones sensibles
			if str, ok := v.(string); ok {
				sanitized[k] = sanitizeString(str)
			} else {
				sanitized[k] = v
			}
		}
	}
	return sanitized
}

// containsCaseInsensitive verifica si un slice contiene un string (case-insensitive)
func containsCaseInsensitive(slice []string, item string) bool {
	itemLower := strings.ToLower(item)
	for _, s := range slice {
		if strings.ToLower(s) == itemLower {
			return true
		}
	}
	return false
}

// sanitizeString sanitiza strings que puedan contener información sensible
func sanitizeString(s string) string {
	// Si parece un token (largo y alfanumérico), redactarlo
	if len(s) > 50 && isAlphanumeric(s) {
		return "***REDACTED_TOKEN***"
	}
	return s
}

// isAlphanumeric verifica si un string es principalmente alfanumérico
func isAlphanumeric(s string) bool {
	alphanumCount := 0
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			alphanumCount++
		}
	}
	return float64(alphanumCount)/float64(len(s)) > 0.9
}

// LogSecurityEvent registra eventos de seguridad importantes
func LogSecurityEvent(eventType string, details map[string]interface{}) {
	sanitized := SanitizeForLog(details)
	Logger.Warn("SECURITY_EVENT",
		zap.String("event_type", eventType),
		zap.Any("details", sanitized),
	)
}

// LogAuthAttempt registra intentos de autenticación
func LogAuthAttempt(email string, success bool, ip string) {
	if success {
		Logger.Info("Authentication successful",
			zap.String("email", email),
			zap.String("ip", ip),
		)
	} else {
		Logger.Warn("Authentication failed",
			zap.String("email", email),
			zap.String("ip", ip),
		)
	}
}

// LogAPIAccess registra accesos a la API
func LogAPIAccess(method, path, ip string, statusCode int, duration int64) {
	logger := Logger.Info
	if statusCode >= 400 {
		logger = Logger.Warn
	}
	if statusCode >= 500 {
		logger = Logger.Error
	}

	logger("API Access",
		zap.String("method", method),
		zap.String("path", path),
		zap.String("ip", ip),
		zap.Int("status", statusCode),
		zap.Int64("duration_ms", duration),
	)
}
