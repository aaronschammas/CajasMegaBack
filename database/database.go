package database

import (
	"caja-fuerte/models"
	"fmt"
	"log"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() { //crea una DB que se llame "fuerte_caja" ta muy feo esto viejo cambialo en algun momento
	// DSN para conectarse al servidor (sin seleccionar una base)
	serverDSN := "root:12345@tcp(127.0.0.1:3306)/?charset=utf8mb4&parseTime=True&loc=Local"
	// Nombre de la base que queremos usar/crear
	dbName := "fuerte_caja"

	// Abrir conexión al servidor para comprobar si la base existe
	serverDB, err := gorm.Open(mysql.Open(serverDSN), &gorm.Config{})
	if err != nil {
		log.Fatal("Error al conectar con el servidor de base de datos:", err)
	}

	// Verificar existencia de la base de datos
	exists, err := isDatabasePresent(serverDB, dbName)
	if err != nil {
		log.Fatal("Error al comprobar existencia de la base datos:", err)
	}
	if !exists {
		// Crear la base de datos si no existe
		createStmt := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;", dbName)
		if err := serverDB.Exec(createStmt).Error; err != nil {
			log.Fatal("Error al crear la base de datos:", err)
		}
		log.Printf("Base de datos '%s' creada (si no existía).\n", dbName)
	}

	// Ahora conectamos a la base de datos específica
	dsn := fmt.Sprintf("root:12345@tcp(127.0.0.1:3306)/%s?charset=utf8mb4&parseTime=True&loc=Local", dbName)

	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Error al conectar con la base de datos:", err)
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
		log.Fatal("Error en la migración:", err)
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
				-- Nuevo comportamiento: mostrar el total del arco como ingresos - egresos
				COALESCE(SUM(CASE WHEN m.movement_type = 'Ingreso' THEN m.amount ELSE 0 END), 0)
				- COALESCE(SUM(CASE WHEN m.movement_type = 'Egreso' THEN m.amount ELSE 0 END), 0)
				AS saldo_total
			FROM
				arcos a
			LEFT JOIN
				movements m ON m.arco_id = a.id AND m.deleted_at IS NULL
			GROUP BY
				a.id, a.fecha_apertura, a.fecha_cierre, a.turno, a.activo, a.saldo_inicial;`
	if err := DB.Exec(vistaSQL).Error; err != nil {
		log.Fatal("Error al crear la vista de saldo de arqueos:", err)
	}

	// Datos iniciales
	seedData()

	fmt.Println("Base de datos inicializada correctamente")
}

// isDatabasePresent revisa si el schema (base de datos) existe en el servidor MySQL.
// Recibe una conexión GORM abierta al servidor (sin seleccionar una base) y el nombre del schema.
func isDatabasePresent(serverDB *gorm.DB, dbName string) (bool, error) {
	var count int64
	// Consultamos INFORMATION_SCHEMA.SCHEMATA
	if err := serverDB.Raw("SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?", dbName).Scan(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func seedData() {
	// Crear roles
	adminRole := models.Role{RoleName: "Administrador General"}
	DB.FirstOrCreate(&adminRole, models.Role{RoleName: "Administrador General"})

	// Crear un usuario de prueba
	adminUser := models.User{
		Email:        "admin@megacajas.com",
		PasswordHash: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // "password"
		FullName:     "Administrador",
		RoleID:       adminRole.RoleID,
		IsActive:     true,
	}
	DB.FirstOrCreate(&adminUser, models.User{Email: adminUser.Email})

	// Crear tres conceptos de prueba
	var adminUserIDToSeed *uint
	if adminUser.UserID != 0 {
		adminUserIDToSeed = &adminUser.UserID
	}
	concepts := []models.ConceptType{
		{ConceptName: "Concepto 1", MovementTypeAssociation: "Ingreso", IsActive: true, CreatedBy: adminUserIDToSeed},
		{ConceptName: "Concepto 2", MovementTypeAssociation: "Egreso", IsActive: true, CreatedBy: adminUserIDToSeed},
		{ConceptName: "Concepto 3", MovementTypeAssociation: "Ambos", IsActive: true, CreatedBy: adminUserIDToSeed},
	}
	for _, concept := range concepts {
		DB.FirstOrCreate(&concept, models.ConceptType{ConceptName: concept.ConceptName})
	}

	log.Println("Solo un usuario y tres conceptos de prueba creados.")
}
