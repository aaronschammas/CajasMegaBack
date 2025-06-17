package database

import (
	"caja-fuerte/models"
	"fmt"
	"log"

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

}
