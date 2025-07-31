package database

import (
	"caja-fuerte/models"
	"fmt"
	"log"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() { //crea una DB que se llame "fuerte_caja" en MySQL
	dsn := "root:@tcp(127.0.0.1:3306)/fuerte_caja?charset=utf8mb4&parseTime=True&loc=Local"

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Error al conectar con la base de datos:", err)
	}

	// Auto-migración
	err = DB.AutoMigrate(
		&models.Role{},
		&models.User{},
		&models.ConceptType{},
		&models.Arco{}, // NUEVO: migración de la tabla Arco
		&models.Movement{},
		&models.SpecificIncome{},
		&models.SpecificExpense{},
	)
	if err != nil {
		log.Fatal("Error en la migración:", err)
	}

	// Datos iniciales
	seedData()

	fmt.Println("Base de datos inicializada correctamente")
}

func seedData() {
	// Si ya existen movimientos, no volver a seedear datos masivos
	var movCount int64
	DB.Model(&models.Movement{}).Count(&movCount)
	if movCount > 0 {
		log.Println("La base de datos ya tiene datos, se omite el seed masivo.")
		return
	}

	adminRole := models.Role{RoleName: "Administrador General"}
	DB.FirstOrCreate(&adminRole, models.Role{RoleName: "Administrador General"})

	userRole := models.Role{RoleName: "Usuario Normal"}
	DB.FirstOrCreate(&userRole, models.Role{RoleName: "Usuario Normal"})

	if adminRole.RoleID == 0 {
		log.Println("ADVERTENCIA: No se pudo crear o encontrar el rol de administrador. Deteniendo el seeding de usuarios y conceptos.")
		return
	}

	// La contraseña es "password"
	adminUser := models.User{
		Email:        "admin@megacajas.com", //usuario por defecto para pruebas que se crea en la DB
		PasswordHash: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi",
		FullName:     "Administrador",
		RoleID:       adminRole.RoleID, // Se usa el ID que GORM ya populó
		IsActive:     true,
	}
	// Usamos FirstOrCreate para evitar duplicados en ejecuciones posteriores
	result := DB.FirstOrCreate(&adminUser, models.User{Email: "admin@megacajas.com"})

	// 3. Crear conceptos iniciales usando el UserID del administrador
	// Solo continuamos si el usuario fue recién creado, para evitar añadir conceptos repetidamente.
	if result.RowsAffected > 0 {
		var adminUserIDToSeed *uint
		if adminUser.UserID != 0 {
			adminUserIDToSeed = &adminUser.UserID
		}

		concepts := []models.ConceptType{
			{ConceptName: "Venta al contado", MovementTypeAssociation: "Ingreso", IsActive: true, CreatedBy: adminUserIDToSeed},
			{ConceptName: "Pago alquiler", MovementTypeAssociation: "Egreso", IsActive: true, CreatedBy: adminUserIDToSeed},
			{ConceptName: "Servicios", MovementTypeAssociation: "Ambos", IsActive: true, CreatedBy: adminUserIDToSeed},
			{ConceptName: "Otro", MovementTypeAssociation: "Ambos", IsActive: true, CreatedBy: adminUserIDToSeed},
		}

		for _, concept := range concepts {
			DB.FirstOrCreate(&concept, models.ConceptType{ConceptName: concept.ConceptName})
		}
		log.Println("Datos iniciales (conceptos) creados.")
	}

	// --- SEED MASIVO DE DATOS DE PRUEBA ---
	// Crear usuarios de prueba
	for i := 1; i <= 10; i++ {
		user := models.User{
			Email:        fmt.Sprintf("usuario%d@megacajas.com", i),
			PasswordHash: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // "password"
			FullName:     fmt.Sprintf("Usuario %d", i),
			RoleID:       userRole.RoleID,
			IsActive:     true,
		}
		DB.FirstOrCreate(&user, models.User{Email: user.Email})
	}

	// Crear arcos de prueba para los últimos 7 días y ambos turnos
	var users []models.User
	DB.Find(&users)
	for d := 0; d < 7; d++ {
		fecha := time.Now().AddDate(0, 0, -d).Truncate(24 * time.Hour)
		for _, turno := range []string{"M", "T"} {
			for _, user := range users {
				arco := models.Arco{
					CreatedBy:     user.UserID,
					FechaApertura: fecha.Add(time.Hour * time.Duration(8+4*d)),
					HoraApertura:  fecha.Add(time.Hour * time.Duration(8+4*d)),
					Turno:         turno,
					Activo:        false,
					Fecha:         fecha,
					FechaCierre:   nil,
					HoraCierre:    nil,
				}
				DB.FirstOrCreate(&arco, models.Arco{CreatedBy: user.UserID, Fecha: fecha, Turno: turno})
			}
		}
	}

	// Crear movimientos de prueba para cada arco
	var arcos []models.Arco
	DB.Find(&arcos)
	for _, arco := range arcos {
		for j := 0; j < 20; j++ { // 20 movimientos por arco
			mov := models.Movement{
				ReferenceID:  fmt.Sprintf("%d-%d-%d", arco.ID, j+1, arco.CreatedBy),
				MovementType: []string{"Ingreso", "Egreso"}[j%2],
				MovementDate: arco.FechaApertura.Add(time.Minute * time.Duration(j*10)),
				Amount:       float64(100 + j*5),
				Shift:        arco.Turno,
				ConceptID:    uint((j % 4) + 1),
				Details:      fmt.Sprintf("Movimiento de prueba %d", j+1),
				CreatedBy:    arco.CreatedBy,
				CreatedAt:    arco.FechaApertura.Add(time.Minute * time.Duration(j*10)),
				ArcoID:       arco.ID,
			}
			DB.Create(&mov)
			if mov.MovementType == "Ingreso" {
				DB.Create(&models.SpecificIncome{MovementID: mov.MovementID})
			} else {
				DB.Create(&models.SpecificExpense{MovementID: mov.MovementID})
			}
		}
	}
	log.Println("Datos masivos de prueba generados.")
}
