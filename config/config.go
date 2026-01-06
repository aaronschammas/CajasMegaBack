package config

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	// Configuración de la Aplicación
	Environment string
	AppName     string
	AppPort     string
	AppURL      string

	// Configuración de Base de Datos
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBCharset  string

	// Configuración de Seguridad
	JWTSecret          string
	JWTExpirationHours int
	PasswordSaltRounds int

	// Configuración de CORS
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string

	// Configuración de Rate Limiting
	RateLimitRequests int
	RateLimitDuration time.Duration

	// Configuración de Logs
	LogLevel string
	LogFile  string

	// Configuración de Inicialización
	CreateDefaultAdmin bool
	DefaultAdminEmail  string
	DefaultAdminPass   string

	// NUEVAS CONFIGURACIONES DE SEGURIDAD
	EnableCSRF      bool
	EnableRateLimit bool
	MaxRequestSize  int64 // en bytes
	RequestTimeout  time.Duration
	SessionDuration time.Duration
}

var AppConfig *Config

func LoadConfig() *Config {

	_ = godotenv.Load() // intentamos cargar, si no existe, sigue (no fatal)

	envFinal := getEnv("APP_ENV", "development")

	// Si estamos en development, ya se cargó .env; si estamos en production,
	// asumimos systemd o entorno ya puso variables.
	config := &Config{
		// Aplicación
		Environment: envFinal,
		AppName:     getEnv("APP_NAME", "CajaFuerte"),
		AppPort:     getEnv("APP_PORT", "8080"),
		AppURL:      getEnv("APP_URL", "http://localhost:8080"),

		// Base de Datos
		DBHost:     getEnv("DB_HOST", "127.0.0.1"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBUser:     getEnv("DB_USER", "root"),
		DBPassword: getEnv("DB_PASSWORD", ""),
		DBName:     getEnv("DB_NAME", "fuerte_caja"),
		DBCharset:  getEnv("DB_CHARSET", "utf8mb4"),

		// Seguridad
		JWTSecret:          getEnv("JWT_SECRET", generateSecureSecret(envFinal)),
		JWTExpirationHours: getEnvAsInt("JWT_EXPIRATION_HOURS", 24),
		PasswordSaltRounds: getEnvAsInt("PASSWORD_SALT_ROUNDS", 12),

		// CORS
		AllowedOrigins: getAllowedOrigins(envFinal),
		AllowedMethods: getEnvAsSlice("ALLOWED_METHODS", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		AllowedHeaders: getEnvAsSlice("ALLOWED_HEADERS", []string{"Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"}),

		// Rate Limiting
		RateLimitRequests: getEnvAsInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitDuration: time.Duration(getEnvAsInt("RATE_LIMIT_DURATION_SECONDS", 60)) * time.Second,

		// Logs
		LogLevel: getEnv("LOG_LEVEL", getDefaultLogLevel(envFinal)),
		LogFile:  getEnv("LOG_FILE", ""),

		// Inicialización
		CreateDefaultAdmin: getEnvAsBool("CREATE_DEFAULT_ADMIN", false),
		DefaultAdminEmail:  getEnv("DEFAULT_ADMIN_EMAIL", ""),
		DefaultAdminPass:   getEnv("DEFAULT_ADMIN_PASSWORD", ""),

		// Seguridad Adicional
		EnableCSRF:      getEnvAsBool("ENABLE_CSRF", envFinal == "production"),
		EnableRateLimit: getEnvAsBool("ENABLE_RATE_LIMIT", true),
		MaxRequestSize:  int64(getEnvAsInt("MAX_REQUEST_SIZE_MB", 10)) * 1024 * 1024,
		RequestTimeout:  time.Duration(getEnvAsInt("REQUEST_TIMEOUT_SECONDS", 30)) * time.Second,
		SessionDuration: time.Duration(getEnvAsInt("SESSION_DURATION_HOURS", 24)) * time.Hour,
	}

	// Validaciones críticas para producción
	if config.Environment == "production" {
		if err := config.validateProductionConfig(); err != nil {
			log.Fatal("❌ ERRORES DE CONFIGURACIÓN PARA PRODUCCIÓN:\n", err)
		}
	}

	AppConfig = config
	return config
}

// validateProductionConfig valida que la configuración sea segura para producción
func (c *Config) validateProductionConfig() error {
	errors := []string{}

	// JWT Secret debe ser fuerte en producción
	if len(c.JWTSecret) < 64 {
		errors = append(errors, "JWT_SECRET debe tener al menos 64 caracteres en producción")
	}

	// La contraseña de base de datos no debe ser la predeterminada
	weakPasswords := []string{"12345", "root", "password", "admin", ""}
	for _, weak := range weakPasswords {
		if c.DBPassword == weak {
			errors = append(errors, "DB_PASSWORD debe ser una contraseña segura en producción (por favor que no salga este error)")
			break
		}
	}

	// Usuario de BD no debe ser root
	if c.DBUser == "root" {
		errors = append(errors, "DB_USER no debe ser 'root' en producción")
	}

	// CORS no debe permitir todos los orígenes
	if len(c.AllowedOrigins) == 1 && c.AllowedOrigins[0] == "*" {
		errors = append(errors, "CORS no debe permitir todos los orígenes (*) en producción")
	}

	// JWT expiration debe ser razonable
	if c.JWTExpirationHours > 168 { // 7 días
		log.Println("ADVERTENCIA: JWT_EXPIRATION_HOURS es muy alto (>7 días)")
	}

	// Password salt rounds debe ser suficiente
	if c.PasswordSaltRounds < 12 {
		errors = append(errors, "PASSWORD_SALT_ROUNDS debe ser al menos 12 en producción")
	}

	// Si hay errores críticos, retornarlos
	if len(errors) > 0 {
		return fmt.Errorf("%s", strings.Join(errors, "\n"))
	}

	log.Println("Configuración validada para producción")
	return nil
}

// GetDSN retorna el Data Source Name para la conexión a MySQL
func (c *Config) GetDSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=%s&parseTime=True&loc=Local",
		c.DBUser,
		c.DBPassword,
		c.DBHost,
		c.DBPort,
		c.DBName,
		c.DBCharset,
	)
}

// GetServerDSN retorna el DSN para conectarse al servidor sin especificar base de datos
func (c *Config) GetServerDSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/?charset=%s&parseTime=True&loc=Local",
		c.DBUser,
		c.DBPassword,
		c.DBHost,
		c.DBPort,
		c.DBCharset,
	)
}

// IsDevelopment retorna true si estamos en modo desarrollo
func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

// IsProduction retorna true si estamos en modo producción
func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

// Funciones auxiliares

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	valueStr := os.Getenv(key)
	if value, err := strconv.ParseBool(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func getEnvAsSlice(key string, defaultValue []string) []string {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}

	var result []string
	for _, v := range strings.Split(valueStr, ",") {
		trimmed := strings.TrimSpace(v)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// getAllowedOrigins retorna los orígenes permitidos según el entorno
func getAllowedOrigins(env string) []string {
	originsStr := os.Getenv("ALLOWED_ORIGINS")

	if env == "production" {
		if originsStr == "" {
			log.Fatal("ALLOWED_ORIGINS debe estar configurado en producción")
		}
		if originsStr == "*" {
			log.Fatal("ALLOWED_ORIGINS no puede ser '*' en producción")
		}
		return strings.Split(originsStr, ",")
	}

	// En desarrollo, permitir localhost con puertos específicos
	if originsStr != "" {
		return strings.Split(originsStr, ",")
	}

	return []string{
		"http://localhost:8080",
		"http://localhost:3000",
		"http://127.0.0.1:8080",
	}
}

// generateSecureSecret genera un secret seguro
func generateSecureSecret(env string) string {
	if env == "production" {
		log.Fatal("JWT_SECRET debe estar configurado en producción. No se puede usar un valor generado automáticamente.")
	}

	log.Println("ADVERTENCIA: Generando JWT_SECRET temporal para desarrollo. NO USAR EN PRODUCCIÓN")

	// Generar 64 bytes aleatorios
	b := make([]byte, 64)
	if _, err := rand.Read(b); err != nil {
		log.Fatal("Error generando secret:", err)
	}

	return base64.StdEncoding.EncodeToString(b)
}

// getDefaultLogLevel retorna el nivel de log por defecto según el entorno
func getDefaultLogLevel(env string) string {
	if env == "production" {
		return "info"
	}
	return "debug"
}
