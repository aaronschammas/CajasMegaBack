package main

import (
	"caja-fuerte/database"
	"caja-fuerte/routes"
	"log"
)

func main() {
	// Inicializar base de datos
	database.InitDB() //

	// Configurar rutas
	r := routes.SetupRoutes() //

	// Iniciar servidor
	log.Println("Servidor iniciado en puerto :8080") //
	if err := r.Run(":8080"); err != nil {           //
		log.Fatal("Error al iniciar servidor:", err) //
	}
}
