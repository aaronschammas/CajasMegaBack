package database

import (
	"caja-fuerte/models" //
	"fmt"                //
	"log"                //

	"gorm.io/driver/mysql" //
	"gorm.io/gorm"         //
)

var DB *gorm.DB //

func InitDB() { //
	dsn := "root:@tcp(127.0.0.1:3306)/megacajas?charset=utf8mb4&parseTime=True&loc=Local" //

	var err error                                        //
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{}) //
	if err != nil {                                      //
		log.Fatal("Error al conectar con la base de datos:", err) //
	}

	// Auto-migración
	err = DB.AutoMigrate( //
		&models.Role{},            //
		&models.User{},            //
		&models.ConceptType{},     //
		&models.Movement{},        //
		&models.SpecificIncome{},  //
		&models.SpecificExpense{}, //
	)
	if err != nil { //
		log.Fatal("Error en la migración:", err) //
	}

	// Datos iniciales
	seedData() //

	fmt.Println("Base de datos inicializada correctamente") //
}

func seedData() { //
	// Crear roles iniciales
	adminRole := models.Role{RoleName: "Administrador General"} //
	userRole := models.Role{RoleName: "Usuario Normal"}         //

	DB.FirstOrCreate(&adminRole, models.Role{RoleName: "Administrador General"}) //
	DB.FirstOrCreate(&userRole, models.Role{RoleName: "Usuario Normal"})         //

	// Crear usuario administrador inicial
	// La contraseña "password" hasheada con bcrypt.DefaultCost
	adminUser := models.User{ //
		Email:        "admin@megacajas.com",                                          //
		PasswordHash: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", //
		FullName:     "Administrador",                                                //
		RoleID:       adminRole.RoleID,                                               //
		IsActive:     true,                                                           //
	}
	DB.FirstOrCreate(&adminUser, models.User{Email: "admin@megacajas.com"}) //

	var seededAdminUser models.User
	// CORRECTED LINE: Removed 'database.' prefix
	DB.Where("email = ?", "admin@megacajas.com").First(&seededAdminUser) //
	var adminUserIDToSeed *uint
	if seededAdminUser.UserID != 0 {
		adminUserIDToSeed = &seededAdminUser.UserID
	}

	concepts := []models.ConceptType{ //
		{ConceptName: "Venta al contado", MovementTypeAssociation: "Ingreso", IsActive: true, CreatedBy: adminUserIDToSeed}, //
		{ConceptName: "Pago alquiler", MovementTypeAssociation: "Egreso", IsActive: true, CreatedBy: adminUserIDToSeed},     //
		{ConceptName: "Servicios", MovementTypeAssociation: "Ambos", IsActive: true, CreatedBy: adminUserIDToSeed},          //
		{ConceptName: "Otro", MovementTypeAssociation: "Ambos", IsActive: true, CreatedBy: adminUserIDToSeed},               //
	}

	for _, concept := range concepts { //
		DB.FirstOrCreate(&concept, models.ConceptType{ConceptName: concept.ConceptName}) //
	}
}
