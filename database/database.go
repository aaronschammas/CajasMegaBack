package database

import (
	"caja-fuerte/config"
	"caja-fuerte/models"
	"errors"
	"fmt"
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB inicializa la conexión a la base de datos con manejo robusto de errores
func InitDB() {
	cfg := config.AppConfig
	if cfg == nil {
		log.Fatal("❌ Config no inicializado. Llama config.LoadConfig() primero.")
	}

	// Configurar logger de GORM según el entorno
	var gormLogger logger.Interface
	if cfg.IsProduction() {
		gormLogger = logger.Default.LogMode(logger.Error)
	} else {
		gormLogger = logger.Default.LogMode(logger.Info)
	}

	// DSN para conectarse al servidor (sin seleccionar una base)
	serverDSN := fmt.Sprintf("%s:%s@tcp(%s:%s)/?charset=%s&parseTime=True&loc=Local",
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBCharset,
	)

	dbName := cfg.DBName

	// Validar nombre de base de datos
	if err := validateDBName(dbName); err != nil {
		log.Fatal("❌ Nombre de base de datos inválido:", err)
	}

	// Abrir conexión al servidor
	serverDB, err := gorm.Open(mysql.Open(serverDSN), &gorm.Config{
		Logger: gormLogger,
	})
	if err != nil {
		log.Fatal("❌ Error al conectar con el servidor de base de datos:", err)
	}

	// Verificar y crear base de datos si no existe
	if err := ensureDatabaseExists(serverDB, dbName); err != nil {
		log.Fatal("❌ Error al verificar/crear base de datos:", err)
	}

	// Conectar a la base de datos específica
	dsn := cfg.GetDSN()
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: gormLogger,
	})
	if err != nil {
		log.Fatal("❌ Error al conectar con la base de datos:", err)
	}

	// Configurar pool de conexiones
	if err := configureConnectionPool(DB); err != nil {
		log.Fatal("❌ Error al configurar pool de conexiones:", err)
	}

	// Ejecutar migraciones
	if err := runMigrations(DB); err != nil {
		log.Fatal("❌ Error en las migraciones:", err)
	}

	// Crear vista de saldo de arqueos
	if err := createSaldoArqueosView(DB); err != nil {
		log.Fatal("❌ Error al crear vista de saldo de arqueos:", err)
	}

	// Crear datos iniciales
	if err := seedInitialData(DB, cfg); err != nil {
		log.Fatal("❌ Error al crear datos iniciales:", err)
	}

	log.Println("✅ Base de datos inicializada correctamente")
}

// validateDBName valida que el nombre de la base de datos sea seguro
func validateDBName(dbName string) error {
	if dbName == "" {
		return errors.New("el nombre de la base de datos no puede estar vacío")
	}
	if len(dbName) > 64 {
		return errors.New("el nombre de la base de datos es demasiado largo (máx 64 caracteres)")
	}
	// Validar caracteres permitidos (alfanuméricos y guión bajo)
	for _, char := range dbName {
		if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') || char == '_') {
			return fmt.Errorf("carácter no permitido en nombre de BD: %c", char)
		}
	}
	return nil
}

// ensureDatabaseExists verifica y crea la base de datos si no existe
func ensureDatabaseExists(serverDB *gorm.DB, dbName string) error {
	exists, err := isDatabasePresent(serverDB, dbName)
	if err != nil {
		return fmt.Errorf("error al verificar existencia de BD: %w", err)
	}

	if !exists {
		// Usar parámetros preparados no es posible para CREATE DATABASE
		// pero validamos el nombre antes
		createStmt := fmt.Sprintf(
			"CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
			dbName,
		)
		if err := serverDB.Exec(createStmt).Error; err != nil {
			return fmt.Errorf("error al crear BD: %w", err)
		}
		log.Printf("✅ Base de datos '%s' creada\n", dbName)
	} else {
		log.Printf("ℹ️  Base de datos '%s' ya existe\n", dbName)
	}

	return nil
}

// isDatabasePresent verifica si una base de datos existe
func isDatabasePresent(serverDB *gorm.DB, dbName string) (bool, error) {
	var count int64
	query := "SELECT COUNT(*) FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?"
	if err := serverDB.Raw(query, dbName).Scan(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// configureConnectionPool configura el pool de conexiones de la BD
func configureConnectionPool(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}

	// Configuración recomendada para producción
	sqlDB.SetMaxIdleConns(10)      // Conexiones idle
	sqlDB.SetMaxOpenConns(100)     // Máximo de conexiones abiertas
	sqlDB.SetConnMaxLifetime(3600) // 1 hora

	return nil
}

// runMigrations ejecuta las migraciones de la base de datos
func runMigrations(db *gorm.DB) error {
	models := []interface{}{
		&models.Role{},
		&models.User{},
		&models.ConceptType{},
		&models.Arco{},
		&models.Movement{},
		&models.SpecificIncome{},
		&models.SpecificExpense{},
	}

	log.Println("🔄 Ejecutando migraciones...")

	for _, model := range models {
		if err := db.AutoMigrate(model); err != nil {
			return fmt.Errorf("error al migrar %T: %w", model, err)
		}
	}

	log.Println("✅ Migraciones completadas")
	return nil
}

// createSaldoArqueosView crea o actualiza la vista de saldo de arqueos
func createSaldoArqueosView(db *gorm.DB) error {
	vistaSQL := `
		CREATE OR REPLACE VIEW vista_saldo_arqueos AS
		SELECT
			a.id AS arqueo_id,
			a.fecha_apertura,
			a.fecha_cierre,
			a.turno,
			a.activo,
			a.saldo_inicial,
			COALESCE(SUM(CASE WHEN m.movement_type = 'Ingreso' THEN m.amount ELSE 0 END), 0) AS total_ingresos,
			COALESCE(SUM(CASE WHEN m.movement_type = 'Egreso' THEN m.amount ELSE 0 END), 0) AS total_egresos,
			COALESCE(SUM(CASE WHEN m.movement_type = 'RetiroCaja' THEN m.amount ELSE 0 END), 0) AS total_retiros,
			(
				a.saldo_inicial
				+ COALESCE(SUM(CASE WHEN m.movement_type = 'Ingreso' THEN m.amount ELSE 0 END), 0)
				- COALESCE(SUM(CASE WHEN m.movement_type = 'Egreso' THEN m.amount ELSE 0 END), 0)
				- COALESCE(SUM(CASE WHEN m.movement_type = 'RetiroCaja' THEN m.amount ELSE 0 END), 0)
			) AS saldo_total
		FROM
			arcos a
		LEFT JOIN
			movements m ON m.arco_id = a.id AND m.deleted_at IS NULL
		GROUP BY
			a.id, a.fecha_apertura, a.fecha_cierre, a.turno, a.activo, a.saldo_inicial`

	if err := db.Exec(vistaSQL).Error; err != nil {
		return fmt.Errorf("error al crear vista: %w", err)
	}

	log.Println("✅ Vista 'vista_saldo_arqueos' actualizada")
	return nil
}

// seedInitialData crea datos iniciales del sistema
func seedInitialData(db *gorm.DB, cfg *config.Config) error {
	// 1. Crear roles
	if err := createDefaultRoles(db); err != nil {
		return fmt.Errorf("error al crear roles: %w", err)
	}

	// 2. Crear usuario administrador
	if err := createAdminUser(db, cfg); err != nil {
		return fmt.Errorf("error al crear usuario admin: %w", err)
	}

	// 3. Crear conceptos básicos
	if err := createDefaultConcepts(db); err != nil {
		return fmt.Errorf("error al crear conceptos: %w", err)
	}

	return nil
}

// createDefaultRoles crea los roles por defecto del sistema
func createDefaultRoles(db *gorm.DB) error {
	roles := []models.Role{
		{RoleName: "Usuario"},
		{RoleName: "Administrador General"},
		{RoleName: "Supervisor"},
	}

	for _, role := range roles {
		var existingRole models.Role
		result := db.Where("role_name = ?", role.RoleName).First(&existingRole)

		if result.Error != nil {
			if errors.Is(result.Error, gorm.ErrRecordNotFound) {
				// Crear el rol si no existe
				if err := db.Create(&role).Error; err != nil {
					return fmt.Errorf("error al crear rol '%s': %w", role.RoleName, err)
				}
				log.Printf("✅ Rol '%s' creado\n", role.RoleName)
			} else {
				return result.Error
			}
		} else {
			log.Printf("ℹ️  Rol '%s' ya existe\n", role.RoleName)
		}
	}

	return nil
}

// createAdminUser crea el usuario administrador
func createAdminUser(db *gorm.DB, cfg *config.Config) error {
	// Obtener credenciales de admin desde variables de entorno o usar valores por defecto
	adminEmail := os.Getenv("DEFAULT_ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = cfg.DefaultAdminEmail
		if adminEmail == "" {
			adminEmail = "admin@admin.com"
		}
	}

	adminPassword := os.Getenv("DEFAULT_ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = cfg.DefaultAdminPass
		if adminPassword == "" {
			// En producción, esto debe fallar
			if cfg.IsProduction() {
				return errors.New("DEFAULT_ADMIN_PASSWORD debe estar configurado en producción")
			}
			adminPassword = "admin123456" // Solo para desarrollo
			log.Println("⚠️  ADVERTENCIA: Usando password por defecto para admin (solo desarrollo)")
		}
	}

	// Verificar si el admin ya existe
	var existingAdmin models.User
	result := db.Where("email = ?", adminEmail).First(&existingAdmin)

	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			// Obtener rol de administrador
			var adminRole models.Role
			if err := db.Where("role_name = ?", "Administrador General").First(&adminRole).Error; err != nil {
				return fmt.Errorf("rol de administrador no encontrado: %w", err)
			}

			// Hash de la contraseña
			hashedPassword, err := bcrypt.GenerateFromPassword(
				[]byte(adminPassword),
				cfg.PasswordSaltRounds,
			)
			if err != nil {
				return fmt.Errorf("error al hashear password: %w", err)
			}

			// Crear usuario admin
			adminUser := models.User{
				Email:        adminEmail,
				PasswordHash: string(hashedPassword),
				FullName:     "Administrador del Sistema",
				RoleID:       adminRole.RoleID,
				IsActive:     true,
			}

			if err := db.Create(&adminUser).Error; err != nil {
				return fmt.Errorf("error al crear usuario admin: %w", err)
			}

			log.Printf("✅ Usuario admin creado: %s\n", adminEmail)

			// Solo mostrar password en desarrollo
			if !cfg.IsProduction() {
				log.Printf("🔑 Password: %s\n", adminPassword)
			}
		} else {
			return result.Error
		}
	} else {
		log.Printf("ℹ️  Usuario admin '%s' ya existe\n", adminEmail)
	}

	return nil
}

// createDefaultConcepts crea los conceptos básicos del sistema
func createDefaultConcepts(db *gorm.DB) error {
	// Verificar si ya existen conceptos
	var conceptCount int64
	db.Model(&models.ConceptType{}).Count(&conceptCount)

	if conceptCount > 0 {
		log.Printf("ℹ️  Ya existen %d conceptos en el sistema\n", conceptCount)
		return nil
	}

	// Obtener el primer usuario (admin) para asignar como creador
	var firstUser models.User
	if err := db.First(&firstUser).Error; err != nil {
		return fmt.Errorf("no se encontró usuario para asignar conceptos: %w", err)
	}

	userIDPtr := &firstUser.UserID

	concepts := []models.ConceptType{
		{
			ConceptName:             "Venta",
			MovementTypeAssociation: "Ingreso",
			IsActive:                true,
			CreatedBy:               userIDPtr,
		},
		{
			ConceptName:             "Compra de Mercadería",
			MovementTypeAssociation: "Egreso",
			IsActive:                true,
			CreatedBy:               userIDPtr,
		},
		{
			ConceptName:             "Gastos Generales",
			MovementTypeAssociation: "Egreso",
			IsActive:                true,
			CreatedBy:               userIDPtr,
		},
		{
			ConceptName:             "Servicios",
			MovementTypeAssociation: "Egreso",
			IsActive:                true,
			CreatedBy:               userIDPtr,
		},
		{
			ConceptName:             "Varios",
			MovementTypeAssociation: "Ambos",
			IsActive:                true,
			CreatedBy:               userIDPtr,
		},
		{
			ConceptName:             "Retiro de Efectivo",
			MovementTypeAssociation: "RetiroCaja",
			IsActive:                true,
			CreatedBy:               userIDPtr,
		},
	}

	for _, concept := range concepts {
		if err := db.Create(&concept).Error; err != nil {
			return fmt.Errorf("error al crear concepto '%s': %w", concept.ConceptName, err)
		}
	}

	log.Printf("✅ %d conceptos básicos creados\n", len(concepts))
	return nil
}

// HealthCheck verifica el estado de la conexión a la base de datos
func HealthCheck() error {
	if DB == nil {
		return errors.New("base de datos no inicializada")
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}

	return sqlDB.Ping()
}

// Close cierra la conexión a la base de datos de forma segura
func Close() error {
	if DB == nil {
		return nil
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}

	return sqlDB.Close()
}
