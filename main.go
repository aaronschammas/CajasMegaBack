package main

import (
	"caja-fuerte/config"
	"caja-fuerte/database"
	"caja-fuerte/routes"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	// Banner de inicio
	printBanner()

	// Cargar configuración
	cfg := config.LoadConfig()
	log.Printf("🚀 Iniciando %s en modo %s", cfg.AppName, cfg.Environment)

	// Inicializar base de datos
	database.InitDB()
	defer func() {
		// No hay función Close en database, así que omitir
	}()

	// Configurar rutas
	router := routes.SetupRoutes(cfg)

	// Crear servidor HTTP
	server := &http.Server{
		Addr:           fmt.Sprintf(":%s", cfg.AppPort),
		Handler:        router,
		ReadTimeout:    15 * time.Second,
		WriteTimeout:   15 * time.Second,
		IdleTimeout:    60 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1 MB
	}

	// Canal para manejar errores del servidor
	serverErrors := make(chan error, 1)

	// Iniciar servidor en goroutine
	go func() {
		log.Printf("✅ Servidor iniciado en http://localhost:%s", cfg.AppPort)
		log.Printf("📝 Documentación API disponible en http://localhost:%s/api/docs", cfg.AppPort)

		if cfg.IsProduction() {
			log.Println("🔒 Modo PRODUCCIÓN activado")
			log.Println("⚠️  Asegúrate de:")
			log.Println("   - Usar HTTPS (reverse proxy como Nginx)")
			log.Println("   - Configurar firewall")
			log.Println("   - Tener backups automáticos")
			log.Println("   - Monitorear logs y métricas")
		}

		serverErrors <- server.ListenAndServe()
	}()

	// Canal para señales del sistema operativo
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	// Esperar señal de apagado o error del servidor
	select {
	case err := <-serverErrors:
		log.Fatalf("❌ Error del servidor: %v", err)
	case sig := <-shutdown:
		log.Printf("\n🛑 Señal de apagado recibida: %v", sig)

		// Dar tiempo para que las conexiones actuales terminen (graceful shutdown)
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		log.Println("🔄 Cerrando conexiones activas...")
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("⚠️  Error durante el apagado graceful: %v", err)
			if err := server.Close(); err != nil {
				log.Fatalf("❌ Error al forzar el cierre del servidor: %v", err)
			}
		}

		log.Println("✅ Servidor detenido correctamente")
	}
}

func printBanner() {
	banner := `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██████╗ █████╗      ██╗ █████╗     ███████╗██╗   ██╗  ║
║  ██╔════╝██╔══██╗     ██║██╔══██╗    ██╔════╝╚██╗ ██╔╝  ║
║  ██║     ███████║     ██║███████║    █████╗   ╚████╔╝   ║
║  ██║     ██╔══██║██   ██║██╔══██║    ██╔══╝    ╚██╔╝    ║
║  ╚██████╗██║  ██║╚█████╔╝██║  ██║    ██║        ██║     ║
║   ╚═════╝╚═╝  ╚═╝ ╚════╝ ╚═╝  ╚═╝    ╚═╝        ╚═╝     ║
║                                                           ║
║            SISTEMA DE GESTIÓN DE CAJA FUERTE             ║
║                    Versión 1.0.0                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`
	fmt.Println(banner)
}
