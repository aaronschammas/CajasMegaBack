package database

import (
	"caja-fuerte/config"
	"caja-fuerte/models"
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	cfg := config.AppConfig
	if cfg == nil {
		log.Fatal("❌ Config no inicializado. Llama config.LoadConfig() primero.")
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

	// Abrir conexión al servidor
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
		createStmt := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;", dbName)
		if err := serverDB.Exec(createStmt).Error; err != nil {
			log.Fatal("❌ Error al crear la base de datos:", err)
		}
		log.Printf("✅ Base de datos '%s' creada.\n", dbName)
	}

	// Conectar a la base de datos específica
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

	// Creación de vista
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

	log.Println("✅ Vista 'vista_saldo_arqueos' actualizada correctamente")

	// Crear datos iniciales (solo usuario admin y conceptos básicos)
	seedInitialData()

	fmt.Println("✅ Base de datos inicializada correctamente")
}

func isDatabasePresent(serverDB *gorm.DB, dbName string) (bool, error) {
	var count int64
	if err := serverDB.Raw("SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?", dbName).Scan(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// seedInitialData crea solo el usuario admin hernan@admin y conceptos básicos
func seedInitialData() {
	// 1. Crear roles
	userRole := models.Role{RoleName: "Usuario"}
	DB.FirstOrCreate(&userRole, models.Role{RoleName: "Usuario"})

	adminRole := models.Role{RoleName: "Administrador General"}
	DB.FirstOrCreate(&adminRole, models.Role{RoleName: "Administrador General"})

	log.Println("✅ Roles creados/verificados")

	// 2. Crear usuario admin hernan@admin con password 221532
	var existingAdmin models.User
	if err := DB.Where("email = ?", "hernan@admin").First(&existingAdmin).Error; err != nil {
		// No existe, crear
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("221532"), 12)
		if err != nil {
			log.Fatal("❌ Error al hashear password del admin:", err)
		}

		adminUser := models.User{
			Email:        "hernan@admin",
			PasswordHash: string(hashedPassword),
			FullName:     "Hernán Administrador",
			RoleID:       adminRole.RoleID,
			IsActive:     true,
		}

		if err := DB.Create(&adminUser).Error; err != nil {
			log.Fatal("❌ Error al crear usuario admin:", err)
		}

		log.Println("✅ Usuario admin creado: hernan@admin (password: 221532)")
	} else {
		log.Println("ℹ️  Usuario admin hernan@admin ya existe")
	}

	// 3. Crear conceptos básicos solo si no existen
	var conceptCount int64
	DB.Model(&models.ConceptType{}).Count(&conceptCount)

	if conceptCount == 0 {
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

			log.Println("✅ Conceptos básicos creados")
		}
	}
}
