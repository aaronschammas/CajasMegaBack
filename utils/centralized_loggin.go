package utils

import (
	"context"
	"fmt"
	"os"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// LogAggregator gestiona envío de logs a servicios externos
type LogAggregator struct {
	provider string // "datadog", "elk", "cloudwatch", "graylog", "sentry"
	enabled  bool
}

var aggregator *LogAggregator

// InitAdvancedLogger inicializa logger con soporte para múltiples destinos
func InitAdvancedLogger(env string) error {
	// Configuración base según entorno
	var config zap.Config

	if env == "production" {
		config = zap.NewProductionConfig()
		config.Encoding = "json"
		config.Level = zap.NewAtomicLevelAt(zapcore.InfoLevel)
	} else {
		config = zap.NewDevelopmentConfig()
		config.Encoding = "console"
		config.Level = zap.NewAtomicLevelAt(zapcore.DebugLevel)
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	config.EncoderConfig.MessageKey = "message"
	config.EncoderConfig.CallerKey = "caller"
	config.EncoderConfig.StacktraceKey = "stacktrace"

	// Agregar campos contextuales fijos
	config.InitialFields = map[string]interface{}{
		"service":     "caja-fuerte",
		"version":     "2.0.1",
		"environment": env,
		"host":        getHostname(),
	}

	// Outputs múltiples
	outputs := []string{"stdout"}

	if logFile := os.Getenv("LOG_FILE"); logFile != "" {
		outputs = append(outputs, logFile)
	}

	config.OutputPaths = outputs
	config.ErrorOutputPaths = []string{"stderr"}

	var err error
	Logger, err = config.Build(
		zap.AddCaller(),
		zap.AddStacktrace(zapcore.ErrorLevel),
	)
	if err != nil {
		return err
	}

	SugarLogger = Logger.Sugar()
	zap.ReplaceGlobals(Logger)

	// Inicializar agregador de logs
	initLogAggregator(env)

	Logger.Info("📊 Advanced logging initialized",
		zap.String("environment", env),
		zap.Strings("outputs", outputs),
	)

	return nil
}

// initLogAggregator configura el agregador según el proveedor
func initLogAggregator(env string) {
	provider := os.Getenv("LOG_AGGREGATOR") // "datadog", "elk", "cloudwatch"

	aggregator = &LogAggregator{
		provider: provider,
		enabled:  env == "production" && provider != "",
	}

	if aggregator.enabled {
		Logger.Info("🔗 Log aggregator enabled",
			zap.String("provider", provider),
		)
	}
}

// StructuredLog representa un log estructurado enriquecido
type StructuredLog struct {
	Timestamp   time.Time              `json:"timestamp"`
	Level       string                 `json:"level"`
	Message     string                 `json:"message"`
	Service     string                 `json:"service"`
	Environment string                 `json:"environment"`
	TraceID     string                 `json:"trace_id,omitempty"`
	UserID      uint                   `json:"user_id,omitempty"`
	IP          string                 `json:"ip,omitempty"`
	Method      string                 `json:"method,omitempty"`
	Path        string                 `json:"path,omitempty"`
	StatusCode  int                    `json:"status_code,omitempty"`
	Duration    int64                  `json:"duration_ms,omitempty"`
	Error       string                 `json:"error,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// LogRequest registra request HTTP con contexto completo
func LogRequest(ctx context.Context, method, path, ip string, statusCode int, duration time.Duration, userID uint) {
	log := StructuredLog{
		Timestamp:   time.Now(),
		Level:       getLogLevel(statusCode),
		Message:     "HTTP Request",
		Service:     "caja-fuerte",
		Environment: os.Getenv("APP_ENV"),
		TraceID:     getTraceID(ctx),
		UserID:      userID,
		IP:          ip,
		Method:      method,
		Path:        path,
		StatusCode:  statusCode,
		Duration:    duration.Milliseconds(),
	}

	// Log según nivel
	switch log.Level {
	case "error":
		Logger.Error(log.Message,
			zap.String("trace_id", log.TraceID),
			zap.Uint("user_id", userID),
			zap.String("ip", ip),
			zap.String("method", method),
			zap.String("path", path),
			zap.Int("status", statusCode),
			zap.Int64("duration_ms", log.Duration),
		)
	case "warn":
		Logger.Warn(log.Message,
			zap.String("trace_id", log.TraceID),
			zap.Uint("user_id", userID),
			zap.String("ip", ip),
			zap.String("method", method),
			zap.String("path", path),
			zap.Int("status", statusCode),
			zap.Int64("duration_ms", log.Duration),
		)
	default:
		Logger.Info(log.Message,
			zap.String("trace_id", log.TraceID),
			zap.Uint("user_id", userID),
			zap.String("ip", ip),
			zap.String("method", method),
			zap.String("path", path),
			zap.Int("status", statusCode),
			zap.Int64("duration_ms", log.Duration),
		)
	}

	// Enviar a agregador si está habilitado
	if aggregator != nil && aggregator.enabled {
		sendToAggregator(log)
	}
}

// LogBusinessEvent registra eventos de negocio importantes
func LogBusinessEvent(eventType string, userID uint, details map[string]interface{}) {
	Logger.Info("Business Event",
		zap.String("event_type", eventType),
		zap.Uint("user_id", userID),
		zap.Any("details", details),
		zap.Time("timestamp", time.Now()),
	)

	// Ejemplos de eventos de negocio:
	// - arco_opened, arco_closed
	// - movimiento_created, movimiento_deleted
	// - retiro_caja
	// - backup_completed
	// - secret_rotated
}

// LogSecurityEventAdvanced registra eventos de seguridad con más contexto
func LogSecurityEventAdvanced(eventType string, severity string, details map[string]interface{}) {
	sanitized := SanitizeForLog(details)

	Logger.Warn("SECURITY_EVENT",
		zap.String("event_type", eventType),
		zap.String("severity", severity), // "low", "medium", "high", "critical"
		zap.Any("details", sanitized),
		zap.Time("timestamp", time.Now()),
	)

	// Eventos críticos: enviar alertas
	if severity == "critical" {
		sendSecurityAlert(eventType, sanitized)
	}

	if aggregator != nil && aggregator.enabled {
		sendToAggregator(StructuredLog{
			Timestamp:   time.Now(),
			Level:       "warn",
			Message:     fmt.Sprintf("Security: %s", eventType),
			Service:     "caja-fuerte",
			Environment: os.Getenv("APP_ENV"),
			Metadata:    sanitized,
		})
	}
}

// sendToAggregator envía logs al servicio externo configurado
func sendToAggregator(log StructuredLog) {
	// TODO: Implementar según proveedor

	switch aggregator.provider {
	case "datadog":
		// sendToDatadog(log)
	case "elk":
		// sendToElasticsearch(log)
	case "cloudwatch":
		// sendToCloudWatch(log)
	case "graylog":
		// sendToGraylog(log)
	case "sentry":
		// if log.Level == "error" { sendToSentry(log) }
	}
}

// sendSecurityAlert envía alerta para eventos de seguridad críticos
func sendSecurityAlert(eventType string, details map[string]interface{}) {
	// Integrar con:
	// - PagerDuty
	// - Slack/Discord webhook
	// - Email
	// - SMS (Twilio)

	Logger.Error("🚨 CRITICAL SECURITY EVENT",
		zap.String("event_type", eventType),
		zap.Any("details", details),
	)

	// TODO: Implementar notificaciones
}

// getLogLevel determina el nivel según status code
func getLogLevel(statusCode int) string {
	if statusCode >= 500 {
		return "error"
	}
	if statusCode >= 400 {
		return "warn"
	}
	return "info"
}

// getTraceID extrae o genera trace ID para correlación
func getTraceID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}

	// Extraer de contexto si existe (ej: de middleware de tracing)
	if traceID, ok := ctx.Value("trace_id").(string); ok {
		return traceID
	}

	// Generar uno nuevo si es necesario
	return fmt.Sprintf("trace_%d", time.Now().UnixNano())
}

// getHostname obtiene el hostname del servidor
func getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}

// LogWithContext helper para loggear con contexto enriquecido
func LogWithContext(ctx context.Context, level string, message string, fields map[string]interface{}) {
	zapFields := []zap.Field{
		zap.String("trace_id", getTraceID(ctx)),
		zap.Time("timestamp", time.Now()),
	}

	for k, v := range fields {
		zapFields = append(zapFields, zap.Any(k, v))
	}

	switch level {
	case "debug":
		Logger.Debug(message, zapFields...)
	case "info":
		Logger.Info(message, zapFields...)
	case "warn":
		Logger.Warn(message, zapFields...)
	case "error":
		Logger.Error(message, zapFields...)
	}
}

// GetLogStats retorna estadísticas de logging
func GetLogStats() map[string]interface{} {
	return map[string]interface{}{
		"aggregator_enabled": aggregator != nil && aggregator.enabled,
		"provider":           aggregator.provider,
		"log_file":           os.Getenv("LOG_FILE"),
		"environment":        os.Getenv("APP_ENV"),
	}
}
