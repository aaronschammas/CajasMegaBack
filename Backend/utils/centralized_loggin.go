package utils

import (
	"fmt"
	"time"

	"go.uber.org/zap"
)

// LogSecurityEventAdvanced registra eventos de seguridad con severidad y contexto.
// Llamada desde middleware/rbac.go para eventos de permisos denegados.
func LogSecurityEventAdvanced(eventType string, severity string, details map[string]interface{}) {
	sanitized := SanitizeForLog(details)

	Logger.Warn("SECURITY_EVENT",
		zap.String("event_type", eventType),
		zap.String("severity", severity),
		zap.Any("details", sanitized),
		zap.Time("timestamp", time.Now()),
	)

	if severity == "critical" {
		Logger.Error("🚨 CRITICAL SECURITY EVENT",
			zap.String("event_type", eventType),
			zap.Any("details", sanitized),
		)
	}

	_ = fmt.Sprintf // evitar import no usado
}
