package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	// Configuración de la Aplicación
	Environment string // "development", "staging", "production"
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
	LogLevel string // "debug", "info", "warn", "error"
	LogFile  string

	// Configuración de Inicialización
	CreateDefaultAdmin bool
	DefaultAdminEmail  string
	DefaultAdminPass   string
}

var AppConfig *Config

// LoadConfig carga la configuración desde variables de entorno
func LoadConfig() *Config {
	// Intentar cargar el archivo .env si existe (solo en desarrollo)
	env := os.Getenv("APP_ENV")
	if env == "" || env == "development" {
		if err := godotenv.Load(); err != nil {
			log.Println("⚠️  No se encontró archivo .env, usando variables de entorno del sistema")
		} else {
			log.Println("✅ Archivo .env cargado correctamente")
		}
	}

	config := &Config{
		// Aplicación
		Environment: getEnv("APP_ENV", "development"),
		AppName:     getEnv("APP_NAME", "CajaFuerte"),
		AppPort:     getEnv("APP_PORT", "8080"),
		AppURL:      getEnv("APP_URL", "http://localhost:8080"),

		// Base de Datos
		DBHost:     getEnv("DB_HOST", "127.0.0.1"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBUser:     getEnv("DB_USER", "root"),
		DBPassword: getEnv("DB_PASSWORD", "12345"),
		DBName:     getEnv("DB_NAME", "fuerte_caja"),
		DBCharset:  getEnv("DB_CHARSET", "utf8mb4"),

		// Seguridad
		JWTSecret:          getEnv("JWT_SECRET", generateDefaultSecret()),
		JWTExpirationHours: getEnvAsInt("JWT_EXPIRATION_HOURS", 24),
		PasswordSaltRounds: getEnvAsInt("PASSWORD_SALT_ROUNDS", 10),

		// CORS
		AllowedOrigins: getEnvAsSlice("ALLOWED_ORIGINS", []string{"*"}),
		AllowedMethods: getEnvAsSlice("ALLOWED_METHODS", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		AllowedHeaders: getEnvAsSlice("ALLOWED_HEADERS", []string{"Content-Type", "Authorization", "X-Requested-With"}),

		// Rate Limiting
		RateLimitRequests: getEnvAsInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitDuration: time.Duration(getEnvAsInt("RATE_LIMIT_DURATION_SECONDS", 60)) * time.Second,

		// Logs
		LogLevel: getEnv("LOG_LEVEL", "info"),
		LogFile:  getEnv("LOG_FILE", ""),

		// Inicialización
		CreateDefaultAdmin: getEnvAsBool("CREATE_DEFAULT_ADMIN", false),
		DefaultAdminEmail:  getEnv("DEFAULT_ADMIN_EMAIL", ""),
		DefaultAdminPass:   getEnv("DEFAULT_ADMIN_PASSWORD", ""),
	}

	// Validaciones críticas para producción
	if config.Environment == "production" {
		config.validateProductionConfig()
	}

	AppConfig = config
	return config
}

// validateProductionConfig valida que la configuración sea segura para producción
func (c *Config) validateProductionConfig() {
	errors := []string{}

	// JWT Secret debe ser fuerte en producción
	if len(c.JWTSecret) < 32 {
		errors = append(errors, "JWT_SECRET debe tener al menos 32 caracteres en producción")
	}

	// La contraseña de base de datos no debe ser la predeterminada
	if c.DBPassword == "12345" || c.DBPassword == "root" || c.DBPassword == "" {
		errors = append(errors, "DB_PASSWORD debe ser una contraseña segura en producción")
	}

	// CORS no debe permitir todos los orígenes
	if len(c.AllowedOrigins) == 1 && c.AllowedOrigins[0] == "*" {
		log.Println("⚠️  ADVERTENCIA: CORS permite todos los orígenes. Esto es inseguro en producción.")
	}

	// Si hay errores críticos, detener la aplicación
	if len(errors) > 0 {
		log.Fatal("❌ ERRORES DE CONFIGURACIÓN PARA PRODUCCIÓN:\n", joinErrors(errors))
	}

	log.Println("✅ Configuración validada para producción")
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

// Funciones auxiliares para leer variables de entorno

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
	// Separar por comas
	var result []string
	for _, v := range splitString(valueStr, ",") {
		result = append(result, trimSpace(v))
	}
	return result
}

func generateDefaultSecret() string {
	log.Println("⚠️  ADVERTENCIA: No se configuró JWT_SECRET. Generando uno temporal (NO USAR EN PRODUCCIÓN)")
	return "CHANGE_THIS_SECRET_KEY_IN_PRODUCTION_DO_NOT_USE_THIS_DEFAULT_VALUE"
}

func joinErrors(errors []string) string {
	result := ""
	for i, err := range errors {
		result += fmt.Sprintf("%d. %s\n", i+1, err)
	}
	return result
}

func splitString(s, sep string) []string {
	var result []string
	current := ""
	for _, char := range s {
		if string(char) == sep {
			if current != "" {
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

func trimSpace(s string) string {
	start := 0
	end := len(s)

	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}

	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}

	return s[start:end]
}
