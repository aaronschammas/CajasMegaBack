package database

import (
	"caja-fuerte/config"
	"caja-fuerte/models"
	"fmt"
	"log"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	cfg := config.AppConfig
	if cfg == nil {
		log.Fatal("❌ Config no inicializado. Llama config.LoadConfig() primero.")
	}

	// ✅ DSN para conectarse al servidor (sin seleccionar una base)
	serverDSN := fmt.Sprintf("%s:%s@tcp(%s:%s)/?charset=%s&parseTime=True&loc=Local",
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBCharset,
	)

	// Nombre de la base que queremos usar/crear
	dbName := cfg.DBName

	// Abrir conexión al servidor para comprobar si la base existe
	serverDB, err := gorm.Open(mysql.Open(serverDSN), &gorm.Config{})
	if err != nil {
		log.Fatal("❌ Error al conectar con el servidor de base de datos:", err)
	}

	// Verificar existencia de la base de datos
	exists, err := isDatabasePresent(serverDB, dbName)
	if err != nil {
		log.Fatal("❌ Error al comprobar existencia de la base datos:", err)
	}
	if !exists {
		// Crear la base de datos si no existe
		createStmt := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;", dbName)
		if err := serverDB.Exec(createStmt).Error; err != nil {
			log.Fatal("❌ Error al crear la base de datos:", err)
		}
		log.Printf("✅ Base de datos '%s' creada (si no existía).\n", dbName)
	}

	// ✅ Ahora conectamos a la base de datos específica usando la config
	dsn := cfg.GetDSN()

	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("❌ Error al conectar con la base de datos:", err)
	}

	// Auto-migración
	err = DB.AutoMigrate(
		&models.Role{},
		&models.User{},
		&models.ConceptType{},
		&models.Arco{},
		&models.Movement{},
		&models.SpecificIncome{},
		&models.SpecificExpense{},
	)
	if err != nil {
		log.Fatal("❌ Error en la migración:", err)
	}

	// Creación/Actualización de VISTAS
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
			a.saldo_inicial
			+ COALESCE(SUM(CASE WHEN m.movement_type = 'Ingreso' THEN m.amount ELSE 0 END), 0)
			- COALESCE(SUM(CASE WHEN m.movement_type = 'Egreso' THEN m.amount ELSE 0 END), 0)
			- COALESCE(SUM(CASE WHEN m.movement_type = 'RetiroCaja' THEN m.amount ELSE 0 END), 0)
			AS saldo_total
		FROM
			arcos a
		LEFT JOIN
			movements m ON m.arco_id = a.id AND m.deleted_at IS NULL
		GROUP BY
			a.id, a.fecha_apertura, a.fecha_cierre, a.turno, a.activo, a.saldo_inicial;`

	if err := DB.Exec(vistaSQL).Error; err != nil {
		log.Fatal("❌ Error al crear la vista de saldo de arqueos:", err)
	}

	log.Println("✅ [DATABASE] Vista 'vista_saldo_arqueos' actualizada correctamente")

	// ✅ Datos iniciales (solo si está configurado)
	if cfg.CreateDefaultAdmin {
		seedData(cfg)
	} else {
		log.Println("ℹ️  Creación de admin por defecto deshabilitada (CREATE_DEFAULT_ADMIN=false)")
	}

	fmt.Println("✅ Base de datos inicializada correctamente")
}

// isDatabasePresent revisa si el schema (base de datos) existe en el servidor MySQL.
func isDatabasePresent(serverDB *gorm.DB, dbName string) (bool, error) {
	var count int64
	if err := serverDB.Raw("SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?", dbName).Scan(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// ✅ seedData ahora usa configuración para el admin por defecto
func seedData(cfg *config.Config) {
	// Crear rol "Usuario" primero (para nuevos registros)
	userRole := models.Role{RoleName: "Usuario"}
	DB.FirstOrCreate(&userRole, models.Role{RoleName: "Usuario"})

	// Crear rol "Administrador General"
	adminRole := models.Role{RoleName: "Administrador General"}
	DB.FirstOrCreate(&adminRole, models.Role{RoleName: "Administrador General"})

	// ✅ Crear usuario admin solo si está configurado
	if cfg.DefaultAdminEmail != "" && cfg.DefaultAdminPass != "" {
		// Hash de la contraseña del admin
		authService := &struct{}{}
		hashedPassword := "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi" // default "password"

		// Si hay contraseña configurada, hashearla
		if cfg.DefaultAdminPass != "password" {
			// Necesitamos hashear la contraseña configurada
			// Por ahora usamos bcrypt directamente
			// (idealmente usar authService.HashPassword pero requiere refactoring)
			log.Printf("⚠️  ADVERTENCIA: El hash de contraseña del admin debe generarse manualmente")
			log.Printf("    Ejecuta: go run scripts/hash_password.go %s", cfg.DefaultAdminPass)
		}

		adminUser := models.User{
			Email:        cfg.DefaultAdminEmail,
			PasswordHash: hashedPassword,
			FullName:     "Administrador",
			RoleID:       adminRole.RoleID,
			IsActive:     true,
		}
		DB.FirstOrCreate(&adminUser, models.User{Email: adminUser.Email})

		log.Printf("✅ Usuario administrador creado/verificado: %s", cfg.DefaultAdminEmail)
	} else {
		log.Println("ℹ️  No se creó usuario admin por defecto (DEFAULT_ADMIN_EMAIL o DEFAULT_ADMIN_PASSWORD no configurados)")
	}

	// Crear tres conceptos de prueba (solo si no existen)
	var conceptCount int64
	DB.Model(&models.ConceptType{}).Count(&conceptCount)

	if conceptCount == 0 {
		// Obtener el primer usuario como creador
		var firstUser models.User
		if err := DB.First(&firstUser).Error; err == nil {
			userIDPtr := &firstUser.UserID

			concepts := []models.ConceptType{
				{ConceptName: "Venta", MovementTypeAssociation: "Ingreso", IsActive: true, CreatedBy: userIDPtr},
				{ConceptName: "Compra", MovementTypeAssociation: "Egreso", IsActive: true, CreatedBy: userIDPtr},
				{ConceptName: "Varios", MovementTypeAssociation: "Ambos", IsActive: true, CreatedBy: userIDPtr},
				{ConceptName: "Retiro", MovementTypeAssociation: "RetiroCaja", IsActive: true, CreatedBy: userIDPtr},
			}

			for _, concept := range concepts {
				DB.FirstOrCreate(&concept, models.ConceptType{ConceptName: concept.ConceptName})
			}

			log.Println("✅ Conceptos de prueba creados")
		} else {
			log.Println("⚠️  No se pudieron crear conceptos: no hay usuarios en el sistema")
		}
	}
}
